package io.github.johntao2004.bookkin.ingestion;

import io.github.johntao2004.bookkin.config.BookKinProperties;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile({"api", "worker"})
public class LibraryRootCapabilityService  {
    private static final Logger log = LoggerFactory.getLogger(LibraryRootCapabilityService.class);
    private final LibraryRootRepository roots;
    private final BookKinProperties properties;

    public LibraryRootCapabilityService(LibraryRootRepository roots, BookKinProperties properties) {
        this.roots = roots;
        this.properties = properties;
    }

    public void checkAll() { roots.findAll().forEach(this::check); }

    public void check(LibraryRoot root) {
        Path configured = Path.of(root.configuredPath());
        String canonical = null;
        boolean readable = false;
        boolean writable = false;
        boolean atomicMove = false;
        boolean staging = false;
        Long freeBytes = null;
        try {
            if (!Files.isDirectory(configured) || !Files.isReadable(configured)) {
                roots.updateCapabilities(root.id(), null, LibraryRoot.RootStatus.OFFLINE, false, false, false, false, null);
                return;
            }
            Path real = configured.toRealPath();
            canonical = real.toString();
            readable = true;
            freeBytes = Files.getFileStore(real).getUsableSpace();
            if (Files.isWritable(real)) {
                Path stageDirectory = ensureInternalDirectory(real, ".bookkin-staging");
                Path probe = stageDirectory.resolve(".capability-" + UUID.randomUUID());
                Path moved = probe.resolveSibling(probe.getFileName() + ".moved");
                try {
                    try (FileChannel channel = FileChannel.open(probe, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
                        channel.write(ByteBuffer.wrap(new byte[]{0x50, 0x47}));
                        channel.force(true);
                    }
                    Files.move(probe, moved, StandardCopyOption.ATOMIC_MOVE);
                } finally {
                    Files.deleteIfExists(probe);
                    Files.deleteIfExists(moved);
                }
                ensureInternalDirectory(real, ".bookkin-trash");
                ensureInternalDirectory(real, ".bookkin-cache/covers");
                ensureInternalDirectory(real, ".bookkin-staging/metadata");
                ensureInternalDirectory(real, ".bookkin-staging/uploads");
                ensureInternalDirectory(real, ".bookkin-assets/covers");
                writable = true;
                atomicMove = true;
                staging = true;
            }
        } catch (Exception exception) {
            log.warn("Library root capability check degraded for {}: {}", root.name(), exception.getMessage());
        }
        var status = !readable ? LibraryRoot.RootStatus.OFFLINE : writable ? LibraryRoot.RootStatus.ONLINE : LibraryRoot.RootStatus.READ_ONLY;
        roots.updateCapabilities(root.id(), canonical, status, readable, writable, atomicMove, staging, freeBytes);
    }

    private Path ensureInternalDirectory(Path root, String relative) throws java.io.IOException {
        Path current = root;
        for (Path segment : Path.of(relative)) {
            current = current.resolve(segment);
            if (Files.exists(current, LinkOption.NOFOLLOW_LINKS)) {
                if (Files.isSymbolicLink(current) || !Files.isDirectory(current, LinkOption.NOFOLLOW_LINKS)) {
                    throw new java.io.IOException("内部目录不是安全的真实目录: " + current.getFileName());
                }
            } else {
                Files.createDirectory(current);
            }
            if (!current.toRealPath().startsWith(root)) throw new java.io.IOException("内部目录越过书库根目录");
        }
        return current;
    }
}
