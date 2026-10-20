package com.elexvx.bookkin.filemanagement;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.catalog.BookCoverRepository;
import com.elexvx.bookkin.ingestion.LibraryRootRepository;
import com.elexvx.bookkin.users.UserRepository;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("worker")
// Worker 定期处理过期回收、版本及封面资源；清理路径仍需指纹和边界检查。
// Worker retention sweeps handle expired trash, versions and covers while retaining path/fingerprint checks.
public class RetentionWorker {
    private static final Logger log = LoggerFactory.getLogger(RetentionWorker.class);
    private final RecycleBinRepository recycleBin;
    private final FileVersionRepository versions;
    private final FileOperationRepository operations;
    private final BookCoverRepository covers;
    private final LibraryRootRepository roots;
    private final UserRepository users;
    private final FileFingerprints fingerprints;
    private final AuditService audit;

    public RetentionWorker(RecycleBinRepository recycleBin, FileVersionRepository versions,
                           FileOperationRepository operations, BookCoverRepository covers,
                           LibraryRootRepository roots, UserRepository users,
                           FileFingerprints fingerprints, AuditService audit) {
        this.recycleBin = recycleBin;
        this.versions = versions;
        this.operations = operations;
        this.covers = covers;
        this.roots = roots;
        this.users = users;
        this.fingerprints = fingerprints;
        this.audit = audit;
    }

    @Scheduled(cron = "0 30 3 * * *")
    public void enforceRetention() {
        operations.deleteExpiredPreviews();
        var owner = users.findOwner().orElse(null);
        if (owner == null) return;
        for (var entry : recycleBin.findExpired(200)) {
            try {
                var root = roots.findById(entry.libraryRootId()).orElseThrow();
                operations.createDirect(owner.id(), "retention:recycle:" + entry.id(), FileOperationType.PURGE,
                        entry.bookFileId(), entry.id(), null, root.id(), root.id(),
                        root.name() + "/" + entry.trashPath(), null, entry.fingerprint());
            } catch (Exception exception) {
                log.warn("Unable to queue expired recycle entry {}: {}", entry.id(), exception.getMessage());
            }
        }
        for (var version : versions.findExpired(200)) cleanupVersion(owner.id(), version);
        enforceCoverRetention();
    }

    // 已确认的封面重置及时清理，不等每日保留期任务。
    /** Confirmed cover resets should not wait for the daily retention sweep. */
    @Scheduled(fixedDelay = 60_000)
    public synchronized void enforceCoverRetention() {
        var owner = users.findOwner().orElse(null);
        if (owner == null) return;
        for (var cover : covers.findExpired(200)) cleanupCover(owner.id(), cover);
    }

    private void cleanupVersion(java.util.UUID ownerId, FileVersionRepository.FileVersion version) {
        try {
            var root = roots.findById(version.libraryRootId()).orElseThrow();
            Path rootPath = Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath()).toRealPath();
            Path path = rootPath.resolve(version.versionPath()).normalize();
            if (!path.startsWith(rootPath)) throw new IllegalStateException("Version path escaped root");
            if (Files.exists(path, LinkOption.NOFOLLOW_LINKS)) {
                if (Files.isSymbolicLink(path)) throw new IllegalStateException("Version path is a symbolic link");
                path = path.toRealPath();
                if (!path.startsWith(rootPath)) throw new IllegalStateException("Version path escaped root");
                String actual = fingerprints.sha256(path);
                if (!actual.equals(version.fingerprint())) throw new IllegalStateException("Version fingerprint changed");
                Files.delete(path);
            }
            versions.delete(version.id());
            audit.record(ownerId, "VERSION_RETENTION_PURGE", "FILE_VERSION", version.id().toString(),
                    version.versionPath(), null, version.fingerprint(), null, "SUCCEEDED", "{}");
        } catch (Exception exception) {
            log.warn("Unable to clean expired file version {}: {}", version.id(), exception.getMessage());
            audit.record(ownerId, "VERSION_RETENTION_PURGE", "FILE_VERSION", version.id().toString(),
                    version.versionPath(), null, version.fingerprint(), null, "FAILED", "{}");
        }
    }

    private void cleanupCover(java.util.UUID ownerId, BookCoverRepository.ExpiredCoverAsset cover) {
        try {
            boolean removed = covers.purgeExpired(cover, () -> {
                try {
                    var root = roots.findById(cover.libraryRootId()).orElseThrow();
                    if (!root.canWrite() || root.status() != com.elexvx.bookkin.ingestion.LibraryRoot.RootStatus.ONLINE)
                        throw new IllegalStateException("Cover root is not writable");
                    Path rootPath = Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath()).toRealPath();
                    Path path = rootPath.resolve(cover.relativePath()).normalize();
                    if (!path.startsWith(rootPath.resolve(".bookkin-assets/covers"))) throw new IllegalStateException("Cover path escaped assets");
                    Path segment = rootPath;
                    for (Path part : rootPath.relativize(path)) {
                        segment = segment.resolve(part);
                        if (Files.isSymbolicLink(segment)) throw new IllegalStateException("Cover path is a symbolic link");
                    }
                    if (Files.exists(path, LinkOption.NOFOLLOW_LINKS)) {
                        if (Files.isSymbolicLink(path)) throw new IllegalStateException("Cover path is a symbolic link");
                        path = path.toRealPath();
                        if (!path.startsWith(rootPath)) throw new IllegalStateException("Cover path escaped root");
                        String actual = fingerprints.sha256(path);
                        if (!actual.equals(cover.fingerprint())) throw new IllegalStateException("Cover fingerprint changed");
                        Files.delete(path);
                    }
                } catch (Exception exception) { throw new IllegalStateException(exception.getMessage(), exception); }
            });
            if (!removed) return;
            audit.record(ownerId, "COVER_RETENTION_PURGE", "BOOK_COVER_ASSET", cover.id().toString(),
                    cover.relativePath(), null, cover.fingerprint(), null, "SUCCEEDED", "{}");
        } catch (Exception exception) {
            log.warn("Unable to clean expired cover asset {}: {}", cover.id(), exception.getMessage());
            audit.record(ownerId, "COVER_RETENTION_PURGE", "BOOK_COVER_ASSET", cover.id().toString(),
                    cover.relativePath(), null, cover.fingerprint(), null, "FAILED", "{}");
        }
    }
}
