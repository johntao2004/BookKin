package com.elexvx.bookkin.filemanagement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.auth.RolePermissionService;
import com.elexvx.bookkin.catalog.BookFile;
import com.elexvx.bookkin.catalog.BookFileStatus;
import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.catalog.BookRepository;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.FileOperationModels.FileConflict;
import com.elexvx.bookkin.filemanagement.FileOperationModels.Operation;
import com.elexvx.bookkin.filemanagement.FileOperationRepository.IdempotencyRecord;
import com.elexvx.bookkin.filemanagement.FileVersionRepository.FileVersion;
import com.elexvx.bookkin.ingestion.LibraryRoot;
import com.elexvx.bookkin.ingestion.LibraryRoot.RootStatus;
import com.elexvx.bookkin.ingestion.LibraryRootRepository;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import com.elexvx.bookkin.users.UserRole;
import com.elexvx.bookkin.users.UserStatus;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FileVersionRestoreTest {
    @TempDir
    Path libraryRoot;

    private final BookRepository books = mock(BookRepository.class);
    private final LibraryRootRepository roots = mock(LibraryRootRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final FileOperationRepository operations = mock(FileOperationRepository.class);
    private final FileVersionRepository versions = mock(FileVersionRepository.class);
    private final FileLeaseRepository leases = mock(FileLeaseRepository.class);
    private final RolePermissionService permissions = mock(RolePermissionService.class);
    private final PathPolicy paths = new PathPolicy();
    private final FileFingerprints fingerprints = new FileFingerprints();
    private final FileOperationService service = new FileOperationService(books, roots, users, operations,
            paths, fingerprints, leases, mock(RecycleBinRepository.class), versions, permissions);

    private final UUID actorId = UUID.randomUUID();
    private final UUID fileId = UUID.randomUUID();
    private final UUID rootId = UUID.randomUUID();
    private final UUID versionId = UUID.randomUUID();
    private final Principal actor = () -> "owner";
    private Path source;
    private Path archive;
    private BookFile file;
    private LibraryRoot root;
    private FileVersion version;

    @BeforeEach
    void setUp() throws Exception {
        source = libraryRoot.resolve("book.pdf");
        Files.writeString(source, "current");
        String currentFingerprint = fingerprints.sha256(source);
        file = new BookFile(fileId, UUID.randomUUID(), rootId, "book.pdf", BookFormat.PDF, BookFileStatus.AVAILABLE,
                Files.size(source), OffsetDateTime.now(), currentFingerprint, false, false, false);
        root = new LibraryRoot(rootId, "测试书库", libraryRoot.toString(), libraryRoot.toRealPath().toString(),
                RootStatus.ONLINE, true, true, true, true, null, OffsetDateTime.now(), null);
        archive = libraryRoot.resolve(".bookkin-versions").resolve(fileId.toString()).resolve("metadata-previous.version");
        Files.createDirectories(archive.getParent());
        Files.writeString(archive, "original");
        version = new FileVersion(versionId, fileId, rootId,
                ".bookkin-versions/" + fileId + "/metadata-previous.version", "book.pdf",
                fingerprints.sha256(archive), Files.size(archive), "METADATA_WRITE", actorId,
                OffsetDateTime.now().minusMinutes(1), OffsetDateTime.now().plusDays(30), null);

        when(users.findByUsername("owner")).thenReturn(Optional.of(new BookKinUser(actorId, "owner", "主人", "hash",
                UserRole.OWNER, UserStatus.ACTIVE, false, OffsetDateTime.now(), null)));
        when(books.findFile(fileId)).thenReturn(Optional.of(file));
        when(roots.findById(rootId)).thenReturn(Optional.of(root));
        when(versions.find(versionId)).thenReturn(Optional.of(version));
        when(leases.hasActiveReadLease(fileId)).thenReturn(false);
    }

    @Test
    void previewRegistersVersionIdAndCurrentFingerprintForTheExistingRestoreExecutor() throws Exception {
        service.previewVersionRestore(versionId, file.fingerprint(), actor);

        verify(permissions).require(actor, "settings.recycle.restore");
        verify(operations).savePreview(eq(actorId), eq(FileOperationType.RESTORE), eq(fileId), eq(rootId), eq(rootId),
                eq("测试书库/book.pdf"), eq("测试书库/book.pdf"), eq(file.fingerprint()), eq(0L),
                argThat((List<FileConflict> conflicts) -> conflicts.isEmpty()), any(), isNull(), eq(versionId));
    }

    @Test
    void changedCurrentFileProducesAConflictAndCannotBeSubmittedAsCleanPreview() throws Exception {
        Files.writeString(source, "outside edit");

        service.previewVersionRestore(versionId, file.fingerprint(), actor);

        verify(operations).savePreview(eq(actorId), eq(FileOperationType.RESTORE), eq(fileId), eq(rootId), eq(rootId),
                any(), any(), eq(file.fingerprint()), eq(0L),
                argThat((List<FileConflict> conflicts) -> conflicts.stream().anyMatch(c -> c.code().equals("SOURCE_CHANGED"))),
                any(), isNull(), eq(versionId));
    }

    @Test
    void versionPathEscapeIsRejectedBeforeAPreviewCanBeCreated() {
        var escaped = new FileVersion(version.id(), version.bookFileId(), version.libraryRootId(),
                ".bookkin-versions/" + fileId + "/../../outside.pdf", version.sourcePath(), version.fingerprint(),
                version.sizeBytes(), version.reason(), version.createdBy(), version.createdAt(), version.expiresAt(), version.restoredAt());
        when(versions.find(versionId)).thenReturn(Optional.of(escaped));

        assertThatThrownBy(() -> service.previewVersionRestore(versionId, file.fingerprint(), actor))
                .isInstanceOfSatisfying(ApiException.class, exception -> assertThat(exception.code()).isEqualTo("UNSAFE_VERSION_PATH"));

        verify(operations, never()).savePreview(any(), any(), any(), any(), any(), any(), any(), any(), anyLong(), any(), any(), any(), any());
    }

    @Test
    void idempotencyKeyCannotBeReusedForAnotherVersion() {
        UUID previousVersionId = UUID.randomUUID();
        UUID previewToken = UUID.randomUUID();
        var existingOperation = new Operation(UUID.randomUUID(), FileOperationType.RESTORE,
                FileOperationStatus.PLANNED, "测试书库/book.pdf", "测试书库/book.pdf", OffsetDateTime.now(),
                "VALIDATING", null, null);
        when(operations.findIdempotency(actorId, "restore-key")).thenReturn(Optional.of(
                new IdempotencyRecord(existingOperation, previewToken, "current-fp", FileOperationType.RESTORE, null, previousVersionId)));

        assertThatThrownBy(() -> service.executeForVersion(versionId,
                new FileOperationModels.ExecuteRequest(previewToken, "current-fp"), "restore-key", actor))
                .isInstanceOfSatisfying(ApiException.class, exception -> assertThat(exception.code()).isEqualTo("IDEMPOTENCY_KEY_REUSED"));

        verify(operations, never()).findPreview(any());
        verify(operations, never()).create(any(), any(), any());
    }
}
