package com.elexvx.bookkin.filemanagement.infrastructure;

import java.io.*;
import java.nio.file.*;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

// 应用专用内部存储，与 NAS 书库根分离；存储名称不取自用户输入。
/** Internal application-owned storage, separate from NAS book roots. Names never come from users. */
@Component
public class PrivateContentStore {
    private final Path root;
    public PrivateContentStore(@Value("${BOOKKIN_CONTENT_STORAGE_PATH:${user.home}/.bookkin/content}") String path) {
        root = Path.of(path).toAbsolutePath().normalize();
    }
    private Path path(String area, UUID owner, UUID id) throws IOException {
        if (!area.equals("articles") && !area.equals("vault")) throw new IOException("Invalid storage area");
        Path directory = root.resolve(area).resolve(owner.toString());
        Files.createDirectories(directory);
        for (Path cursor = directory; cursor != null; cursor = cursor.getParent())
            if (Files.isSymbolicLink(cursor)) throw new IOException("Symbolic links are forbidden");
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
