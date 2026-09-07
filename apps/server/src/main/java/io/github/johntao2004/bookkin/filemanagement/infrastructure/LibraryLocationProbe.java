package io.github.johntao2004.bookkin.filemanagement.infrastructure;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
@Component
public class LibraryLocationProbe {
    private final Path base;
    public LibraryLocationProbe(@Value("${bookkin.storage.registration-base:/library}") String base) { this.base = Path.of(base).toAbsolutePath().normalize(); }
    public Result inspect(String raw) {
        try {
            Path path = Path.of(raw);
            if (!path.isAbsolute() || !path.equals(path.normalize()) || !path.startsWith(base) || path.equals(base))
                throw new IllegalArgumentException("请填写挂载在 " + base + " 下的独立书库目录");
            Path current = path.getRoot();
            for (Path part : path) { current = current.resolve(part); if (Files.isSymbolicLink(current)) throw new IllegalArgumentException("书库路径不能包含软链接"); }
            if (!Files.isDirectory(path) || !Files.isReadable(path)) throw new IllegalArgumentException("Docker 无法读取该目录，请检查目录挂载和权限");
            var real = path.toRealPath();
            var attrs = Files.readAttributes(real, BasicFileAttributes.class);
            String fingerprint = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((real + ":" + attrs.fileKey()).getBytes(StandardCharsets.UTF_8)));
            return new Result(real.toString(), fingerprint, Files.isWritable(real), Files.getFileStore(real).getUsableSpace());
        } catch (IllegalArgumentException e) { throw e; }
        catch (Exception e) { throw new IllegalArgumentException("无法连接书库目录，请检查 Docker 挂载及目录权限"); }
    }
    public record Result(String path, String fingerprint, boolean writable, long freeBytes) {}
}
