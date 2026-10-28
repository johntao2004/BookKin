package com.elexvx.bookkin.ingestion.upload;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.FileFingerprints;
import com.elexvx.bookkin.filemanagement.PathPolicy;
import com.elexvx.bookkin.ingestion.LibraryRoot;
import com.elexvx.bookkin.ingestion.LibraryRootRepository;
import com.elexvx.bookkin.ingestion.upload.BookUploadModels.BookUploadStatus;
import com.elexvx.bookkin.ingestion.upload.BookUploadModels.MetadataDraft;
import com.elexvx.bookkin.ingestion.upload.BookUploadModels.UploadEntity;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import com.elexvx.bookkin.users.UserRole;
import com.elexvx.bookkin.users.UserStatus;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

class BookUploadTextSampleTest {
    @TempDir Path temporary;

    @Test
    void samplesTheRealPdfBodyInsteadOfItsFilenameOrDraftTitle() throws Exception {
        var fixture = fixture(UserRole.OWNER, BookUploadStatus.READY_FOR_REVIEW, null, OffsetDateTime.now().plusHours(1));

        var sample = fixture.service.sampleText(fixture.uploadId, fixture.principal);

        assertTrue(sample.passages().stream().anyMatch(passage -> passage.text().contains("The body contains a unique cognition phrase.")));
        assertFalse(sample.passages().stream().anyMatch(passage -> passage.text().contains("FilenameOnlyTitle")));
        assertFalse(sample.passages().stream().anyMatch(passage -> passage.text().contains("DraftOnlyTitle")));
    }

    @Test
    void allowsAnAdminAndRejectsMembersOtherOwnersNonReadyAndExpiredDrafts() throws Exception {
        var admin = fixture(UserRole.ADMIN, BookUploadStatus.READY_FOR_REVIEW, null, OffsetDateTime.now().plusHours(1));
        assertTrue(admin.service.sampleText(admin.uploadId, admin.principal).totalSections() > 0);

        var member = fixture(UserRole.MEMBER, BookUploadStatus.READY_FOR_REVIEW, null, OffsetDateTime.now().plusHours(1));
        assertApiCode("UPLOAD_TEXT_FORBIDDEN", () -> member.service.sampleText(member.uploadId, member.principal));
        verify(member.uploads, never()).findOwned(member.uploadId, member.actorId);

        var inProgress = fixture(UserRole.OWNER, BookUploadStatus.RECEIVING, null, OffsetDateTime.now().plusHours(1));
        assertApiCode("UPLOAD_STATE", () -> inProgress.service.sampleText(inProgress.uploadId, inProgress.principal));
        verify(inProgress.roots, never()).findById(inProgress.rootId);

        var expired = fixture(UserRole.OWNER, BookUploadStatus.READY_FOR_REVIEW, null, OffsetDateTime.now().minusSeconds(1));
        assertApiCode("UPLOAD_EXPIRED", () -> expired.service.sampleText(expired.uploadId, expired.principal));
        verify(expired.roots, never()).findById(expired.rootId);

        var anotherUsersDraft = fixture(UserRole.ADMIN, BookUploadStatus.READY_FOR_REVIEW, null, OffsetDateTime.now().plusHours(1));
        when(anotherUsersDraft.uploads.findOwned(anotherUsersDraft.uploadId, anotherUsersDraft.actorId)).thenReturn(Optional.empty());
        assertApiCode("UPLOAD_NOT_FOUND", () -> anotherUsersDraft.service.sampleText(anotherUsersDraft.uploadId, anotherUsersDraft.principal));
        verify(anotherUsersDraft.roots, never()).findById(anotherUsersDraft.rootId);
    }

    @Test
    void checksThePersistedFingerprintBeforeAndAfterSampling() throws Exception {
        var fixture = fixture(UserRole.OWNER, BookUploadStatus.READY_FOR_REVIEW, null, OffsetDateTime.now().plusHours(1));

        var changedBefore = org.mockito.Mockito.mock(FileFingerprints.class);
        when(changedBefore.sha256(fixture.staged)).thenReturn("sha256:different");
        assertApiCode("UPLOAD_FILE_CHANGED", () -> service(fixture, changedBefore).sampleText(fixture.uploadId, fixture.principal));
        verify(changedBefore, times(1)).sha256(fixture.staged);

        var changedDuringSampling = org.mockito.Mockito.mock(FileFingerprints.class);
        when(changedDuringSampling.sha256(fixture.staged)).thenReturn(fixture.fingerprint, "sha256:changed");
        assertApiCode("UPLOAD_FILE_CHANGED", () -> service(fixture, changedDuringSampling).sampleText(fixture.uploadId, fixture.principal));
        verify(changedDuringSampling, times(2)).sha256(fixture.staged);
    }

    @Test
    void revalidatesCurrentBytesAndExpiryAfterTheInitialSample() throws Exception {
        var changed = fixture(UserRole.OWNER, BookUploadStatus.READY_FOR_REVIEW, null, OffsetDateTime.now().plusHours(1));
        changed.service.sampleText(changed.uploadId, changed.principal);
        byte[] modified = Files.readAllBytes(changed.staged);
        modified[modified.length - 1] ^= 1;
        Files.write(changed.staged, modified);
        assertApiCode("UPLOAD_FILE_CHANGED", () -> changed.service.verifyTextSource(changed.uploadId, changed.principal));

        var expiring = fixture(UserRole.ADMIN, BookUploadStatus.READY_FOR_REVIEW, null, OffsetDateTime.now().plusHours(1));
        expiring.service.sampleText(expiring.uploadId, expiring.principal);
        var expiredUpload = withExpiry(expiring.upload, OffsetDateTime.now().minusSeconds(1));
        when(expiring.uploads.findOwned(expiring.uploadId, expiring.actorId)).thenReturn(Optional.of(expiredUpload));
        assertApiCode("UPLOAD_EXPIRED", () -> expiring.service.verifyTextSource(expiring.uploadId, expiring.principal));
    }

    @Test
    void rejectsUnexpectedMissingAndSymbolicLinkStagingPaths() throws Exception {
        var unexpected = fixture(UserRole.OWNER, BookUploadStatus.READY_FOR_REVIEW,
                ".bookkin-staging/uploads/other-id/book.part", OffsetDateTime.now().plusHours(1));
        assertApiCode("UPLOAD_STAGING_PATH_INVALID", () -> unexpected.service.sampleText(unexpected.uploadId, unexpected.principal));

        var missing = fixture(UserRole.OWNER, BookUploadStatus.READY_FOR_REVIEW, null, OffsetDateTime.now().plusHours(1));
        Files.delete(missing.staged);
        assertApiCode("UPLOAD_FILE_MISSING", () -> missing.service.sampleText(missing.uploadId, missing.principal));

        var linked = fixture(UserRole.OWNER, BookUploadStatus.READY_FOR_REVIEW, null, OffsetDateTime.now().plusHours(1));
        Files.delete(linked.staged);
        Files.delete(linked.staged.getParent());
        Path outside = temporary.resolve("outside-" + linked.uploadId);
        Files.createDirectories(outside);
        Files.createSymbolicLink(linked.staged.getParent(), outside);
        assertApiCode("UPLOAD_STAGING_PATH_INVALID", () -> linked.service.sampleText(linked.uploadId, linked.principal));
    }

    private Fixture fixture(UserRole role, BookUploadStatus status, String stagingPath, OffsetDateTime expiresAt) throws Exception {
        UUID actorId = UUID.randomUUID();
        UUID uploadId = UUID.randomUUID();
        UUID rootId = UUID.randomUUID();
        Path configuredRoot = temporary.resolve("root-" + uploadId);
        Files.createDirectories(configuredRoot);
        Path rootPath = configuredRoot.toRealPath();
        String expectedPath = ".bookkin-staging/uploads/" + uploadId + "/book.part";
        Path staged = rootPath.resolve(expectedPath);
        Files.createDirectories(staged.getParent());
        createPdf(staged);
        String fingerprint = new FileFingerprints().sha256(staged);
        long size = Files.size(staged);
        OffsetDateTime now = OffsetDateTime.now();

        var uploads = org.mockito.Mockito.mock(BookUploadRepository.class);
        var roots = org.mockito.Mockito.mock(LibraryRootRepository.class);
        var users = org.mockito.Mockito.mock(UserRepository.class);
        var manager = new BookKinUser(actorId, "manager", "Manager", "hash", role, UserStatus.ACTIVE, false, now, null);
        Principal principal = () -> "manager";
        when(users.findByUsername("manager")).thenReturn(Optional.of(manager));
        var upload = new UploadEntity(uploadId, actorId, rootId, "Default", "FilenameOnlyTitle.pdf",
                stagingPath == null ? expectedPath : stagingPath, BookFormat.PDF, size, size, fingerprint, status,
                false, false, false, draft(), draft(), List.of(), null, null, null, null, List.of(), null,
                null, null, null, null, expiresAt, now, now);
        when(uploads.findOwned(uploadId, actorId)).thenReturn(Optional.of(upload));
        var root = new LibraryRoot(rootId, "Default", rootPath.toString(), rootPath.toRealPath().toString(),
                LibraryRoot.RootStatus.ONLINE, true, true, true, true, null, now, null);
        when(roots.findById(rootId)).thenReturn(Optional.of(root));

        var fixture = new Fixture(actorId, uploadId, rootId, staged, fingerprint, principal, uploads, roots, users, upload);
        return fixture.withService(service(fixture, new FileFingerprints()));
    }

    private UploadEntity withExpiry(UploadEntity upload, OffsetDateTime expiresAt) {
        return new UploadEntity(upload.id(), upload.requestedBy(), upload.libraryRootId(), upload.libraryRootName(),
                upload.originalFilename(), upload.stagingPath(), upload.format(), upload.declaredSizeBytes(),
                upload.receivedBytes(), upload.fingerprint(), upload.status(), upload.encrypted(), upload.drmProtected(),
                upload.digitallySigned(), upload.detectedMetadata(), upload.draftMetadata(), upload.metadataCandidates(),
                upload.coverCacheKey(), upload.selectedCoverSource(), upload.selectedCoverStagingPath(),
                upload.duplicateBookId(), upload.similarBookIds(), upload.targetPath(), upload.errorCode(),
                upload.errorDetail(), upload.idempotencyKey(), upload.committedBookId(), expiresAt,
                upload.createdAt(), upload.updatedAt());
    }

    private BookUploadService service(Fixture fixture, FileFingerprints fingerprints) {
        return new BookUploadService(fixture.uploads, null, null, null, null, fixture.roots, null, fixture.users,
                null, fingerprints, new PathPolicy(), null, org.mockito.Mockito.mock(AuditService.class),
                new JsonMapper(), null);
    }

    private MetadataDraft draft() {
        return new MetadataDraft("DraftOnlyTitle", null, List.of("Catalog Author"), List.of(), null, null,
                null, null, null, null, null, List.of(), null, null, Map.of(), "Catalog/DraftOnlyTitle.pdf", true);
    }

    private void createPdf(Path path) throws Exception {
        try (var document = new PDDocument()) {
            document.getDocumentInformation().setTitle("FilenameOnlyTitle");
            var page = new PDPage();
            document.addPage(page);
            try (var stream = new PDPageContentStream(document, page)) {
                stream.beginText();
                stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                stream.newLineAtOffset(50, 700);
                stream.showText("The body contains a unique cognition phrase.");
                stream.endText();
            }
            document.save(path.toFile());
        }
    }

    private void assertApiCode(String expected, org.junit.jupiter.api.function.Executable action) {
        var exception = assertThrows(ApiException.class, action);
        assertTrue(exception.code().equals(expected), "expected " + expected + " but got " + exception.code());
    }

    private record Fixture(UUID actorId, UUID uploadId, UUID rootId, Path staged, String fingerprint,
                           Principal principal, BookUploadRepository uploads, LibraryRootRepository roots,
                           UserRepository users, UploadEntity upload, BookUploadService service) {
        Fixture(UUID actorId, UUID uploadId, UUID rootId, Path staged, String fingerprint, Principal principal,
                BookUploadRepository uploads, LibraryRootRepository roots, UserRepository users, UploadEntity upload) {
            this(actorId, uploadId, rootId, staged, fingerprint, principal, uploads, roots, users, upload, null);
        }
        Fixture withService(BookUploadService service) {
            return new Fixture(actorId, uploadId, rootId, staged, fingerprint, principal, uploads, roots, users, upload, service);
        }
    }
}
