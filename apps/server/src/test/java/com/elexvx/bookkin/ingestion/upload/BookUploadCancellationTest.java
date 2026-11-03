package com.elexvx.bookkin.ingestion.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.catalog.DisplayCatalogService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.config.BookKinProperties;
import com.elexvx.bookkin.filemanagement.FileFingerprints;
import com.elexvx.bookkin.filemanagement.PathPolicy;
import com.elexvx.bookkin.ingestion.CatalogIngestionRepository;
import com.elexvx.bookkin.ingestion.LibraryRoot;
import com.elexvx.bookkin.ingestion.LibraryRootRepository;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.ObjectMapper;

class BookUploadCancellationTest {
    private static final String USERNAME = "cancel-owner";

    @Test
    void staleCancellableSnapshotCannotDeleteFilesAfterAnotherOperationWinsCas(@TempDir Path rootPath) throws Exception {
        for (var staleStatus : List.of(BookUploadModels.BookUploadStatus.RECEIVING,
                BookUploadModels.BookUploadStatus.READY_FOR_REVIEW)) {
            UUID ownerId = UUID.randomUUID();
            UUID rootId = UUID.randomUUID();
            UUID uploadId = UUID.randomUUID();
            Path directory = rootPath.resolve(".bookkin-staging/uploads/" + uploadId);
            Files.createDirectories(directory);
            Path staged = directory.resolve("book.part");
            Files.writeString(staged, "owned by the operation that won the CAS");

            var uploads = mock(BookUploadRepository.class);
            when(uploads.findOwned(uploadId, ownerId)).thenReturn(Optional.of(upload(uploadId, ownerId, rootId, staleStatus)));
            when(uploads.cancelOwnedIfCancellable(uploadId, ownerId)).thenReturn(false);
            var service = service(uploads, owner(ownerId), mock(LibraryRootRepository.class));

            assertThatThrownBy(() -> service.cancel(uploadId, () -> USERNAME))
                    .isInstanceOfSatisfying(ApiException.class,
                            exception -> assertThat(exception.status().value()).isEqualTo(409));
            assertThat(Files.readString(staged)).isEqualTo("owned by the operation that won the CAS");
        }
    }

    @Test
    void refusesProcessingUploadsWithoutTouchingTheirStagingFiles(@TempDir Path rootPath) throws Exception {
        for (var status : List.of(BookUploadModels.BookUploadStatus.INSPECTING,
                BookUploadModels.BookUploadStatus.ENRICHING, BookUploadModels.BookUploadStatus.COMMITTING,
                BookUploadModels.BookUploadStatus.SUCCEEDED)) {
            UUID ownerId = UUID.randomUUID();
            UUID rootId = UUID.randomUUID();
            UUID uploadId = UUID.randomUUID();
            Path directory = rootPath.resolve(".bookkin-staging/uploads/" + uploadId);
            Files.createDirectories(directory);
            Path staged = directory.resolve("book.part");
            Files.writeString(staged, "must remain while processing");

            var uploads = mock(BookUploadRepository.class);
            var users = owner(ownerId);
            when(uploads.findOwned(uploadId, ownerId)).thenReturn(Optional.of(upload(uploadId, ownerId, rootId, status)));
            when(uploads.cancelOwnedIfCancellable(uploadId, ownerId)).thenReturn(false);
            var service = service(uploads, users, mock(LibraryRootRepository.class));

            assertThatThrownBy(() -> service.cancel(uploadId, () -> USERNAME))
                    .isInstanceOfSatisfying(ApiException.class,
                            exception -> assertThat(exception.status().value()).isEqualTo(409));
            assertThat(Files.readString(staged)).isEqualTo("must remain while processing");
            verify(uploads).cancelOwnedIfCancellable(uploadId, ownerId);
        }
    }

    @Test
    void completedCancellationCanRetryFilesystemCleanupWithoutChangingState(@TempDir Path rootPath) throws Exception {
        UUID ownerId = UUID.randomUUID();
        UUID rootId = UUID.randomUUID();
        UUID uploadId = UUID.randomUUID();
        Path directory = rootPath.resolve(".bookkin-staging/uploads/" + uploadId);
        Path nested = directory.resolve("unexpected/nested");
        Files.createDirectories(nested);
        var upload = upload(uploadId, ownerId, rootId, BookUploadModels.BookUploadStatus.RECEIVING);
        var uploads = mock(BookUploadRepository.class);
        when(uploads.findOwned(uploadId, ownerId)).thenReturn(Optional.of(upload));
        when(uploads.cancelOwnedIfCancellable(uploadId, ownerId)).thenReturn(true, false);
        var roots = mock(LibraryRootRepository.class);
        when(roots.findById(rootId)).thenReturn(Optional.of(onlineRoot(rootId, rootPath)));
        var service = service(uploads, owner(ownerId), roots);

        assertThatThrownBy(() -> service.cancel(uploadId, () -> USERNAME))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.code()).isEqualTo("UPLOAD_CLEANUP_FAILED"));
        // State is already terminal, and retrying the same DELETE only finishes cleanup.
        when(uploads.findOwned(uploadId, ownerId)).thenReturn(Optional.of(upload(uploadId, ownerId, rootId,
                BookUploadModels.BookUploadStatus.CANCELLED)));
        Files.delete(nested);
        Files.delete(nested.getParent());
        service.cancel(uploadId, () -> USERNAME);

        assertThat(Files.exists(directory)).isFalse();
        verify(uploads, org.mockito.Mockito.times(2)).cancelOwnedIfCancellable(uploadId, ownerId);
    }

    private static UserRepository owner(UUID ownerId) {
        var owner = mock(BookKinUser.class);
        when(owner.id()).thenReturn(ownerId);
        var users = mock(UserRepository.class);
        when(users.findByUsername(USERNAME)).thenReturn(Optional.of(owner));
        return users;
    }

    private static BookUploadService service(BookUploadRepository uploads, UserRepository users,
            LibraryRootRepository roots) {
        return new BookUploadService(uploads, mock(BookUploadProcessor.class), null, null, null, roots,
                mock(CatalogIngestionRepository.class), users, null, new FileFingerprints(), new PathPolicy(),
                new BookKinProperties(null, null, null, null, null, null, null, null, null, null, null),
                mock(AuditService.class), new ObjectMapper(), mock(DisplayCatalogService.class), null, null);
    }

    private static BookUploadModels.UploadEntity upload(UUID id, UUID ownerId, UUID rootId,
            BookUploadModels.BookUploadStatus status) {
        OffsetDateTime now = OffsetDateTime.now();
        return new BookUploadModels.UploadEntity(id, ownerId, rootId, "root", "book.epub",
                ".bookkin-staging/uploads/" + id + "/book.part", BookFormat.EPUB, 100, 0, null, status,
                false, false, false, null, null, List.of(), null, null, null, null, List.of(), null, null,
                null, null, null, now.plusHours(1), now, now);
    }

    private static LibraryRoot onlineRoot(UUID id, Path path) throws Exception {
        return new LibraryRoot(id, "cancel-root", path.toRealPath().toString(), path.toRealPath().toString(),
                LibraryRoot.RootStatus.ONLINE, true, true, true, true, null, null, null);
    }
}
