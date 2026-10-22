package com.elexvx.bookkin.filemanagement.infrastructure;

import java.io.*;
import java.nio.file.*;
import java.util.UUID;
import java.util.List;
import java.nio.file.attribute.BasicFileAttributes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

// 应用专用内部存储，与 NAS 书库根分离；存储名称不取自用户输入。
/** Internal application-owned storage, separate from NAS book roots. Names never come from users. */
@Component
public class PrivateContentStore {
    private final Path articles;
    private final Path vault;
    public PrivateContentStore(
            @Value("${BOOKKIN_CONTENT_STORAGE_PATH:${user.home}/.bookkin/content}") String path,
            @Value("${BOOKKIN_ARTICLE_STORAGE_PATH:}") String articlePath,
            @Value("${BOOKKIN_VAULT_STORAGE_PATH:}") String vaultPath) {
        Path root = Path.of(path).toAbsolutePath().normalize();
        articles = location(articlePath, root.resolve("articles"));
        vault = location(vaultPath, root.resolve("vault"));
        if (articles.startsWith(vault) || vault.startsWith(articles))
            throw new IllegalArgumentException("文章书库与禁书区目录不能相同或互相包含");
    }
    private static Path location(String configured, Path fallback) {
        if (configured == null || configured.isBlank()) return fallback;
        Path path = Path.of(configured);
        if (!path.isAbsolute()) throw new IllegalArgumentException("素材书库必须使用绝对目录");
        return path.normalize();
    }
    public void initialize() throws IOException {
        createDirectory(articles);
        createDirectory(vault);
    }
    // Only application-owned directories are created here; source book roots are never modified.
    private static void createDirectory(Path directory) throws IOException {
        Path cursor = directory.getRoot();
        for (Path segment : directory) {
            cursor = cursor.resolve(segment);
            if (!Files.exists(cursor, LinkOption.NOFOLLOW_LINKS)) {
                try { Files.createDirectory(cursor); }
                catch (FileAlreadyExistsException concurrentCreation) { /* Check the winner below. */ }
            }
            if (Files.isSymbolicLink(cursor) || !Files.isDirectory(cursor, LinkOption.NOFOLLOW_LINKS))
                throw new IOException("Content storage must use real directories without symbolic links");
        }
    }
    public boolean overlaps(Path candidate) {
        Path normalized = candidate.toAbsolutePath().normalize();
        return List.of(articles, vault).stream().anyMatch(area -> normalized.startsWith(area) || area.startsWith(normalized));
    }
    public List<StorageArea> locations() {
        return List.of(describe("ARTICLES", articles), describe("VAULT", vault));
    }
    private static StorageArea describe(String kind, Path directory) {
        boolean safe = true;
        for (Path cursor = directory; cursor != null; cursor = cursor.getParent()) safe &= !Files.isSymbolicLink(cursor);
        boolean readable = safe && Files.isDirectory(directory) && Files.isReadable(directory);
        boolean writable = readable && Files.isWritable(directory);
        Long freeBytes = null;
        if (readable) try { freeBytes = Files.getFileStore(directory).getUsableSpace(); } catch (IOException ignored) { /* Unknown capacity. */ }
        return new StorageArea(kind, directory.toString(), readable, writable, freeBytes);
    }
    public record StorageArea(String kind, String configuredPath, boolean canRead, boolean canWrite, Long freeBytes) {}
    /** Read-only metadata scan; never opens plaintext, decrypts vault data or follows links. */
    public void scan(String kind) throws IOException {
        Path directory = switch (kind) {
            case "ARTICLES" -> articles;
            case "VAULT" -> vault;
            default -> throw new IOException("Invalid storage area");
        };
        if (!describe(kind, directory).canRead()) throw new IOException("Content storage is unavailable");
        Files.walkFileTree(directory, new SimpleFileVisitor<>() {
            @Override public FileVisitResult preVisitDirectory(Path path, BasicFileAttributes attributes) throws IOException {
                if (!Files.isReadable(path)) throw new IOException("Content directory is unreadable");
                return FileVisitResult.CONTINUE;
            }
            @Override public FileVisitResult visitFile(Path path, BasicFileAttributes attributes) throws IOException {
                if (attributes.isSymbolicLink() || !Files.isReadable(path)) throw new IOException("Unsafe or unreadable content entry");
                return FileVisitResult.CONTINUE;
            }
        });
    }
    private Path path(String area, UUID owner, UUID id) throws IOException {
        if (!area.equals("articles") && !area.equals("vault")) throw new IOException("Invalid storage area");
        Path directory = (area.equals("articles") ? articles : vault).resolve(owner.toString());
        createDirectory(directory);
        Path target = directory.resolve(id.toString());
        if (Files.isSymbolicLink(target)) throw new IOException("Symbolic links are forbidden");
        return target;
    }
    public void create(String area, UUID owner, UUID id, InputStream input, long limit) throws IOException {
        Path target = path(area, owner, id);
        Path staging = Files.createTempFile(target.getParent(), ".upload-", ".tmp");
        try {
            try (var out = new FileOutputStream(staging.toFile())) {
                byte[] buffer = new byte[65536]; long total = 0; int count;
                while ((count = input.read(buffer)) != -1) {
                    total += count; if (total > limit) throw new IOException("Content exceeds size limit");
                    out.write(buffer, 0, count);
                }
                out.getFD().sync();
            }
            // 通过硬链接原子发布，目标已存在时失败而非覆盖。
            // Hard-link publication is atomic and fails rather than replacing an existing object.
            Files.createLink(target, staging);
        } finally { Files.deleteIfExists(staging); }
    }
    public org.springframework.core.io.Resource resource(String area, UUID owner, UUID id) throws IOException {
        return new org.springframework.core.io.FileSystemResource(path(area, owner, id));
    }
    public void delete(String area, UUID owner, UUID id) throws IOException { Files.deleteIfExists(path(area,owner,id)); }
}
