package io.github.johntao2004.bookkin.filemanagement;

import io.github.johntao2004.bookkin.common.ApiException;
import java.io.IOException;
import java.text.Normalizer;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class PathPolicy {
    private static final Set<String> WINDOWS_RESERVED = Set.of(
            "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
            "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9");
    private static final Set<String> INTERNAL_DIRECTORIES = Set.of(".bookkin-trash", ".bookkin-staging", ".bookkin-versions", ".bookkin-cache", ".bookkin-assets");

    public String normalizeRelative(String raw) {
        if (raw == null || raw.isBlank() || raw.indexOf('\0') >= 0) reject("路径不能为空或包含空字符。");
        String portable = Normalizer.normalize(raw, Normalizer.Form.NFC).replace('\\', '/').strip();
        if (portable.startsWith("/") || portable.matches("^[A-Za-z]:.*")) reject("目标路径必须是书库内的相对路径。");
        Path path = Path.of(portable).normalize();
        if (path.isAbsolute() || path.startsWith("..")) reject("路径不能越过书库根目录。");
        for (Path segment : path) {
            String value = segment.toString();
            if (value.equals(".") || value.equals("..") || value.endsWith(".") || value.endsWith(" ")) reject("路径包含不安全的名称。");
            String stem = value.contains(".") ? value.substring(0, value.indexOf('.')) : value;
            if (WINDOWS_RESERVED.contains(stem.toUpperCase(Locale.ROOT))) reject("路径包含系统保留文件名。");
        }
        if (path.getNameCount() == 0 || INTERNAL_DIRECTORIES.contains(path.getName(0).toString())) reject("该目录由BookKin内部管理。");
        return path.toString().replace('\\', '/');
    }

    public Path resolveExisting(Path root, String relative) throws IOException {
        Path canonicalRoot = root.toRealPath();
        Path candidate = canonicalRoot.resolve(normalizeRelative(relative)).normalize();
        Path real = candidate.toRealPath();
        ensureInside(canonicalRoot, real);
        return real;
    }

    public Path resolveTarget(Path root, String relative) throws IOException {
        Path canonicalRoot = root.toRealPath();
        Path candidate = canonicalRoot.resolve(normalizeRelative(relative)).normalize();
        ensureInside(canonicalRoot, candidate);
        Path parent = candidate.getParent();
        while (parent != null && !Files.exists(parent, LinkOption.NOFOLLOW_LINKS)) parent = parent.getParent();
        if (parent == null) reject("无法确认目标目录边界。");
        ensureInside(canonicalRoot, parent.toRealPath());
        return candidate;
    }

    public boolean hasCaseInsensitiveConflict(Path target) throws IOException {
        Path parent = target.getParent();
        if (parent == null || !Files.isDirectory(parent)) return false;
        String wanted = target.getFileName().toString();
        try (var stream = Files.list(parent)) {
            return stream.anyMatch(path -> path.getFileName().toString().equalsIgnoreCase(wanted)
                    && !path.getFileName().toString().equals(wanted));
        }
    }

    private void ensureInside(Path canonicalRoot, Path candidate) {
        if (!candidate.normalize().startsWith(canonicalRoot)) reject("解析后的路径越过书库根目录。");
    }

    private void reject(String message) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "UNSAFE_PATH", message);
    }
}
