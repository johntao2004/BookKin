package io.github.johntao2004.bookkin.filemanagement;

import io.github.johntao2004.bookkin.audit.AuditService;
import io.github.johntao2004.bookkin.catalog.BookCoverRepository;
import io.github.johntao2004.bookkin.ingestion.LibraryRootRepository;
import io.github.johntao2004.bookkin.users.UserRepository;
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
            var root = roots.findById(cover.libraryRootId()).orElseThrow();
            Path rootPath = Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath()).toRealPath();
            Path path = rootPath.resolve(cover.relativePath()).normalize();
            if (!path.startsWith(rootPath)) throw new IllegalStateException("Cover path escaped root");
            if (Files.exists(path, LinkOption.NOFOLLOW_LINKS)) {
                if (Files.isSymbolicLink(path)) throw new IllegalStateException("Cover path is a symbolic link");
                path = path.toRealPath();
                if (!path.startsWith(rootPath)) throw new IllegalStateException("Cover path escaped root");
                String actual = fingerprints.sha256(path);
                if (!actual.equals(cover.fingerprint())) throw new IllegalStateException("Cover fingerprint changed");
                Files.delete(path);
            }
            covers.delete(cover.id());
            audit.record(ownerId, "COVER_RETENTION_PURGE", "BOOK_COVER_ASSET", cover.id().toString(),
                    cover.relativePath(), null, cover.fingerprint(), null, "SUCCEEDED", "{}");
        } catch (Exception exception) {
            log.warn("Unable to clean expired cover asset {}: {}", cover.id(), exception.getMessage());
            audit.record(ownerId, "COVER_RETENTION_PURGE", "BOOK_COVER_ASSET", cover.id().toString(),
                    cover.relativePath(), null, cover.fingerprint(), null, "FAILED", "{}");
        }
    }
}
