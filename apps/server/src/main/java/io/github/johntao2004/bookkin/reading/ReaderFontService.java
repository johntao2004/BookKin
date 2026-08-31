package io.github.johntao2004.bookkin.reading;

import io.github.johntao2004.bookkin.audit.AuditService;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.config.BookKinProperties;
import io.github.johntao2004.bookkin.users.UserRepository;
import jakarta.annotation.PostConstruct;
import java.awt.Font;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.Principal;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class ReaderFontService {
    private final ReaderFontRepository fonts;
    private final UserRepository users;
    private final BookKinProperties properties;
    private final AuditService audit;
    private Path root;

    public ReaderFontService(ReaderFontRepository fonts, UserRepository users, BookKinProperties properties, AuditService audit) {
        this.fonts = fonts;
        this.users = users;
        this.properties = properties;
        this.audit = audit;
    }

    @PostConstruct
    void prepareStorage() {
        root = Path.of(properties.fonts().storagePath()).toAbsolutePath().normalize();
        try {
            ensureDirectory(root);
            ensureDirectory(root.resolve("staging"));
            ensureDirectory(root.resolve("content"));
        } catch (IOException exception) {
            throw new IllegalStateException("字体存储目录不可用", exception);
        }
    }

    public List<ReaderFontView> list(boolean includeDisabled) {
        return fonts.findAll(includeDisabled).stream().map(this::view).toList();
    }

    public ReaderFontView create(String displayName, String kind, String filename, long sizeBytes, String licenseNote, Principal principal) {
        UUID actor = actor(principal);
        Format format = format(filename);
        if (sizeBytes <= 0 || sizeBytes > properties.fonts().maxFileSize()) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FONT_SIZE_LIMIT", "字体文件为空或超过大小限制。");
        }
        String normalizedName = cleanName(displayName, filename);
        String normalizedKind = normalizeKind(kind);
        UUID id = UUID.randomUUID();
        String stagingPath = "staging/" + id + ".part";
        ReaderFontRepository.ReaderFont created = fonts.create(id, normalizedName, normalizedName, normalizedKind,
                format.name(), format.mimeType(), sizeBytes, "pending:" + id, stagingPath, cleanLicense(licenseNote), actor);
        audit.record(actor, "READER_FONT_UPLOAD_STARTED", "READER_FONT", id.toString(), filename, stagingPath,
                null, null, "SUCCEEDED", "{\"format\":\"" + format.name() + "\"}");
        return view(created);
    }

    public ReaderFontView receive(UUID id, long contentLength, InputStream input, Principal principal) throws IOException {
        UUID actor = actor(principal);
        ReaderFontRepository.ReaderFont font = fonts.findById(id).orElseThrow(() -> ApiException.notFound("FONT_NOT_FOUND", "未找到字体上传会话。"));
        if (font.contentPath() != null) return view(fonts.findById(id).orElseThrow());
        if (contentLength >= 0 && contentLength != font.sizeBytes()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FONT_LENGTH_MISMATCH", "实际上传大小与字体会话声明不一致。");
        }
        Path staging = safeChild(root, font.stagingPath());
        Path target = null;
        try {
            Files.deleteIfExists(staging);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[1024 * 1024];
            byte[] signature = new byte[12];
            int signatureLength = 0;
            long written = 0;
            ensureDirectory(staging.getParent());
            try (FileChannel channel = FileChannel.open(staging, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
                int read;
                while ((read = input.read(buffer)) >= 0) {
                    if (read == 0) continue;
                    written += read;
                    if (written > font.sizeBytes() || written > properties.fonts().maxFileSize()) throw new IllegalArgumentException("字体上传超过声明大小");
                    if (signatureLength < signature.length) {
                        int copied = Math.min(signature.length - signatureLength, read);
                        System.arraycopy(buffer, 0, signature, signatureLength, copied);
                        signatureLength += copied;
                    }
                    digest.update(buffer, 0, read);
                    ByteBuffer bytes = ByteBuffer.wrap(buffer, 0, read);
                    while (bytes.hasRemaining()) channel.write(bytes);
                }
                channel.force(true);
            }
            if (written != font.sizeBytes()) throw new IllegalArgumentException("字体文件不完整");
            Format format = Format.valueOf(font.format());
            validateSignature(format, signature, signatureLength);
            String fingerprint = "sha256:" + HexFormat.of().formatHex(digest.digest());
            var duplicate = fonts.findByFingerprint(fingerprint);
            if (duplicate.isPresent() && !duplicate.get().id().equals(id) && duplicate.get().contentPath() != null) {
                Files.deleteIfExists(staging);
                fonts.delete(id);
                audit.record(actor, "READER_FONT_UPLOAD_DEDUPLICATED", "READER_FONT", duplicate.get().id().toString(), font.displayName(), duplicate.get().contentPath(), null, fingerprint, "SUCCEEDED", "{}");
                return view(duplicate.get());
            }
            target = safeChild(root, "content/" + fingerprint.substring("sha256:".length()) + "." + format.extension());
            if (Files.exists(target, LinkOption.NOFOLLOW_LINKS)) {
                if (Files.isSymbolicLink(target) || !Files.isRegularFile(target, LinkOption.NOFOLLOW_LINKS)) throw new IllegalArgumentException("字体目标文件不安全");
                if (!fingerprint.equals(fileFingerprint(target))) throw new IllegalArgumentException("字体目标文件指纹冲突");
                Files.deleteIfExists(staging);
            } else {
                try {
                    Files.move(staging, target, StandardCopyOption.ATOMIC_MOVE);
                } catch (java.nio.file.AtomicMoveNotSupportedException unsupported) {
                    Files.move(staging, target);
                }
            }
            String familyName = internalFamilyName(target, format, font.familyName());
            fonts.received(id, written, fingerprint, root.relativize(target).toString().replace('\\', '/'), familyName);
            audit.record(actor, "READER_FONT_UPLOADED", "READER_FONT", id.toString(), font.displayName(), root.relativize(target).toString(), null, fingerprint, "SUCCEEDED", "{\"sizeBytes\":" + written + "}");
            return view(fonts.findById(id).orElseThrow());
        } catch (ApiException exception) {
            deleteQuietly(staging);
            throw exception;
        } catch (Exception exception) {
            deleteQuietly(staging);
            audit.record(actor, "READER_FONT_UPLOADED", "READER_FONT", id.toString(), font.displayName(), font.stagingPath(), null, null, "FAILED", "{}");
            throw new ApiException(HttpStatus.BAD_REQUEST, "FONT_UPLOAD_FAILED", message(exception));
        }
    }

    public ReaderFontView setStatus(UUID id, String status, Principal principal) {
        UUID actor = actor(principal);
        String normalized = "ENABLED".equals(status) || "DISABLED".equals(status) ? status : "";
        if (normalized.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "FONT_STATUS_INVALID", "字体状态无效。");
        ReaderFontRepository.ReaderFont current = fonts.findById(id).orElseThrow(() -> ApiException.notFound("FONT_NOT_FOUND", "未找到字体。"));
        if ("ENABLED".equals(normalized) && current.contentPath() == null) throw new ApiException(HttpStatus.CONFLICT, "FONT_NOT_READY", "字体文件尚未完成上传。");
        ReaderFontRepository.ReaderFont updated = fonts.setStatus(id, normalized);
        audit.record(actor, "ENABLED".equals(normalized) ? "READER_FONT_ENABLED" : "READER_FONT_DISABLED", "READER_FONT", id.toString(), current.displayName(), current.contentPath(), current.fingerprint(), updated.fingerprint(), "SUCCEEDED", "{}");
        return view(updated);
    }

    @Scheduled(fixedDelay = 60 * 60 * 1000L)
    public void cleanupStaleUploads() {
        if (root == null) return;
        fonts.findStagingBefore(java.time.OffsetDateTime.now().minusHours(24)).forEach(font -> {
            try {
                deleteQuietly(safeChild(root, font.stagingPath()));
                fonts.delete(font.id());
            } catch (RuntimeException ignored) {
                // A stale session is best-effort cleanup; a future run retries the exact path.
            }
        });
    }

    public FontContent content(UUID id) {
        ReaderFontRepository.ReaderFont font = fonts.findEnabledById(id).orElseThrow(() -> ApiException.notFound("FONT_NOT_FOUND", "字体不可用。"));
        Path path = safeChild(root, font.contentPath());
        try {
            if (Files.isSymbolicLink(path) || !Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS) || !font.fingerprint().equals(fileFingerprint(path))) throw new IOException("字体文件校验失败");
            return new FontContent(new FileSystemResource(path), font.mimeType());
        } catch (IOException exception) {
            throw ApiException.notFound("FONT_NOT_FOUND", "字体文件不可用。");
        }
    }

    private ReaderFontView view(ReaderFontRepository.ReaderFont font) {
        return new ReaderFontView(font.id(), font.displayName(), font.familyName(), font.kind(), font.source(), font.status(), font.format(),
                font.contentPath() == null ? null : "/api/v1/reader-fonts/" + font.id() + "/content", font.licenseNote(), font.createdAt());
    }

    private UUID actor(Principal principal) {
        return users.findByUsername(principal.getName()).orElseThrow().id();
    }

    private String normalizeKind(String value) {
        if (!"SERIF".equals(value) && !"SANS".equals(value)) throw new ApiException(HttpStatus.BAD_REQUEST, "FONT_KIND_INVALID", "字体类型无效。");
        return value;
    }

    private String cleanName(String value, String filename) {
        String fallback = basename(filename).replaceFirst("\\.[^.]+$", "");
        String result = value == null || value.isBlank() ? fallback : value.strip();
        if (result.isEmpty() || result.length() > 160) throw new ApiException(HttpStatus.BAD_REQUEST, "FONT_NAME_INVALID", "字体展示名称无效。");
        return result;
    }

    private String cleanLicense(String value) {
        if (value == null || value.isBlank()) return null;
        String result = value.strip();
        if (result.length() > 2000) throw new ApiException(HttpStatus.BAD_REQUEST, "FONT_LICENSE_INVALID", "字体许可说明过长。");
        return result;
    }

    private String basename(String filename) {
        if (filename == null || filename.isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, "FONT_FILENAME_INVALID", "字体文件名不能为空。");
        String normalized = filename.replace('\\', '/');
        String value = normalized.substring(normalized.lastIndexOf('/') + 1).strip();
        if (value.isEmpty() || value.contains("..")) throw new ApiException(HttpStatus.BAD_REQUEST, "FONT_FILENAME_INVALID", "字体文件名无效。");
        return value;
    }

    private Format format(String filename) {
        String extension = basename(filename).substring(basename(filename).lastIndexOf('.') + 1).toUpperCase(Locale.ROOT);
        try {
            return Format.valueOf(extension);
        } catch (IllegalArgumentException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FONT_FORMAT_UNSUPPORTED", "只支持 WOFF2、WOFF、TTF 和 OTF 字体。");
        }
    }

    private void validateSignature(Format format, byte[] signature, int length) {
        String magic = new String(signature, 0, Math.min(4, length), java.nio.charset.StandardCharsets.US_ASCII);
        boolean valid = switch (format) {
            case WOFF2 -> "wOF2".equals(magic);
            case WOFF -> "wOFF".equals(magic);
            case OTF -> "OTTO".equals(magic) || startsWith(signature, length, new byte[]{0, 1, 0, 0});
            case TTF -> startsWith(signature, length, new byte[]{0, 1, 0, 0}) || "true".equals(magic) || "typ1".equals(magic);
        };
        if (!valid) throw new ApiException(HttpStatus.BAD_REQUEST, "FONT_SIGNATURE_INVALID", "字体文件签名与扩展名不匹配。");
    }

    private boolean startsWith(byte[] input, int length, byte[] expected) {
        if (length < expected.length) return false;
        for (int index = 0; index < expected.length; index += 1) if (input[index] != expected[index]) return false;
        return true;
    }

    private String internalFamilyName(Path path, Format format, String fallback) {
        if (format == Format.WOFF || format == Format.WOFF2) return fallback;
        try {
            Font font = Font.createFont(Font.TRUETYPE_FONT, path.toFile());
            String name = font.getFamily(Locale.SIMPLIFIED_CHINESE);
            return name == null || name.isBlank() ? fallback : name;
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private void ensureDirectory(Path path) throws IOException {
        if (Files.exists(path, LinkOption.NOFOLLOW_LINKS)) {
            if (Files.isSymbolicLink(path) || !Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS)) throw new IOException("字体目录不安全");
        } else Files.createDirectories(path);
        if (!path.toRealPath().startsWith(root == null ? path.toAbsolutePath().normalize() : root)) throw new IOException("字体目录越界");
    }

    private Path safeChild(Path base, String relative) {
        if (relative == null || relative.isBlank()) throw new ApiException(HttpStatus.NOT_FOUND, "FONT_NOT_FOUND", "字体文件不存在。");
        Path candidate = base.resolve(relative).normalize();
        if (!candidate.startsWith(base.normalize())) throw new ApiException(HttpStatus.BAD_REQUEST, "FONT_PATH_INVALID", "字体路径无效。");
        return candidate;
    }

    private String fileFingerprint(Path path) throws IOException {
        try (InputStream input = Files.newInputStream(path)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[1024 * 1024];
            int read;
            while ((read = input.read(buffer)) >= 0) if (read > 0) digest.update(buffer, 0, read);
            return "sha256:" + HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private void deleteQuietly(Path path) {
        if (path == null) return;
        try { Files.deleteIfExists(path); } catch (IOException ignored) { }
    }

    private String message(Exception exception) { return exception.getMessage() == null ? "字体上传失败" : exception.getMessage(); }

    public record ReaderFontView(UUID id, String displayName, String familyName, String kind, String source,
                                 String status, String format, String contentUrl, String licenseNote,
                                 java.time.OffsetDateTime createdAt) {}

    public record FontContent(FileSystemResource resource, String mimeType) {}

    private enum Format {
        WOFF2("woff2", "font/woff2"), WOFF("woff", "font/woff"), TTF("ttf", "font/ttf"), OTF("otf", "font/otf");
        private final String extension;
        private final String mimeType;
        Format(String extension, String mimeType) { this.extension = extension; this.mimeType = mimeType; }
        String extension() { return extension; }
        String mimeType() { return mimeType; }
    }
}
