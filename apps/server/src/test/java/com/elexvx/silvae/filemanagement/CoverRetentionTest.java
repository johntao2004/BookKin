// 使用临时文件覆盖指纹冲突、路径越界及软链接，确认清理失败保留可重试状态。
// Uses temporary files for fingerprint conflicts, path escape and symlinks, preserving retryable state on cleanup failure.
package com.elexvx.silvae.filemanagement;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.elexvx.silvae.audit.AuditService;
import com.elexvx.silvae.catalog.BookCoverRepository;
import com.elexvx.silvae.ingestion.LibraryRoot;
import com.elexvx.silvae.ingestion.LibraryRootRepository;
import com.elexvx.silvae.users.SilvaeUser;
import com.elexvx.silvae.users.UserRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class CoverRetentionTest {
    @TempDir Path root;
    final BookCoverRepository covers = mock(BookCoverRepository.class);
    final LibraryRootRepository roots = mock(LibraryRootRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final FileFingerprints fingerprints = new FileFingerprints();
    final AuditService audit = mock(AuditService.class);
    final UUID rootId = UUID.randomUUID();

    void clean(Path path, String fingerprint) throws Exception {
        SilvaeUser owner = mock(SilvaeUser.class);
        when(owner.id()).thenReturn(UUID.randomUUID());
        when(users.findOwner()).thenReturn(Optional.of(owner));
        when(roots.findById(rootId)).thenReturn(Optional.of(new LibraryRoot(rootId, "test", root.toString(), root.toString(), LibraryRoot.RootStatus.ONLINE, true, true, true, true, null, null, null)));
        var asset = new BookCoverRepository.ExpiredCoverAsset(UUID.randomUUID(), UUID.randomUUID(), rootId, root.relativize(path).toString(), fingerprint);
        when(covers.findExpired(200)).thenReturn(List.of(asset));
        when(covers.purgeExpired(eq(asset), any())).thenAnswer(invocation -> { invocation.getArgument(1, Runnable.class).run(); return true; });
        new RetentionWorker(mock(RecycleBinRepository.class), mock(FileVersionRepository.class), mock(FileOperationRepository.class), covers, roots, users, fingerprints, audit).enforceCoverRetention();
    }
    Path image() throws Exception {
        Path directory = Files.createDirectories(root.resolve(".silvae-assets/covers/book"));
        return Files.writeString(directory.resolve("custom.jpg"), "uploaded cover");
    }
    @Test void deletesTheConfirmedExpiredUpload() throws Exception {
        Path image = image();
        clean(image, fingerprints.sha256(image));
        assertFalse(Files.exists(image));
    }
    @Test void fingerprintConflictPreservesTheFileForRetry() throws Exception {
        Path image = image();
        clean(image, "sha256:changed");
        assertTrue(Files.exists(image));
    }
    @Test void neverDeletesFilesOutsideTheCoverAssetDirectory() throws Exception {
        Path source = Files.writeString(root.resolve("original.pdf"), "book");
        clean(source, fingerprints.sha256(source));
        assertTrue(Files.exists(source));
    }
    @Test void refusesSymbolicLinks() throws Exception {
        Path source = Files.writeString(root.resolve("source.jpg"), "keep");
        Path link = Files.createDirectories(root.resolve(".silvae-assets/covers/book")).resolve("link.jpg");
        Files.createSymbolicLink(link, source);
        clean(link, fingerprints.sha256(source));
        assertTrue(Files.exists(source));
        assertTrue(Files.isSymbolicLink(link));
    }
}
