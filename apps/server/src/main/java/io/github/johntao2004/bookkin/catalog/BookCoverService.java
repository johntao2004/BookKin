package io.github.johntao2004.bookkin.catalog;

import io.github.johntao2004.bookkin.audit.AuditService;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.config.BookKinProperties;
import io.github.johntao2004.bookkin.filemanagement.FileFingerprints;
import io.github.johntao2004.bookkin.ingestion.LibraryRoot;
import io.github.johntao2004.bookkin.ingestion.LibraryRootRepository;
import io.github.johntao2004.bookkin.users.UserRepository;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.Principal;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class BookCoverService {
    private final BookRepository books;
    private final BookCoverRepository covers;
    private final LibraryRootRepository roots;
    private final UserRepository users;
    private final FileFingerprints fingerprints;
    private final BookKinProperties properties;
    private final AuditService audit;

    public BookCoverService(BookRepository books, BookCoverRepository covers, LibraryRootRepository roots,
                            UserRepository users, FileFingerprints fingerprints, BookKinProperties properties, AuditService audit) {
        this.books = books;
        this.covers = covers;
        this.roots = roots;
        this.users = users;
        this.fingerprints = fingerprints;
        this.properties = properties;
        this.audit = audit;
    }

    public void upload(UUID bookId, byte[] input, Principal principal) {
        UUID actor = users.findByUsername(principal.getName()).orElseThrow().id();
        var file = books.findPreferredFile(bookId).orElseThrow(() -> ApiException.notFound("BOOK_NOT_FOUND", "未找到这本书。"));
        LibraryRoot root = roots.findById(file.libraryRootId()).orElseThrow();
        if (root.status() != LibraryRoot.RootStatus.ONLINE || !root.canWrite()) throw ApiException.conflict("ROOT_READ_ONLY", "书库当前不可写。");
        byte[] jpeg = normalize(input);
        try {
            Path rootPath = Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath()).toRealPath();
            Path directory = safeDirectories(rootPath, rootPath.resolve(".bookkin-assets/covers/" + bookId));
            Path temporary = directory.resolve(".cover-" + UUID.randomUUID() + ".tmp");
            try (FileChannel channel = FileChannel.open(temporary, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
                channel.write(ByteBuffer.wrap(jpeg));
                channel.force(true);
            }
            String fingerprint = fingerprints.sha256(temporary);
            Path target = directory.resolve(fingerprint.replace("sha256:", "") + ".jpg");
            if (Files.exists(target, LinkOption.NOFOLLOW_LINKS)) {
                if (Files.isSymbolicLink(target) || !Files.isRegularFile(target, LinkOption.NOFOLLOW_LINKS)
                        || !fingerprint.equals(fingerprints.sha256(target))) {
                    throw new IllegalArgumentException("封面目标文件存在冲突");
                }
                Files.delete(temporary);
            } else {
                Files.move(temporary, target);
            }
            BufferedImage image = ImageIO.read(target.toFile());
            covers.activate(bookId, root.id(), rootPath.relativize(target).toString().replace('\\', '/'), fingerprint,
                    image.getWidth(), image.getHeight(), actor);
            audit.record(actor, "BOOK_COVER_CHANGED", "BOOK", bookId.toString(), null,
                    rootPath.relativize(target).toString(), null, fingerprint, "SUCCEEDED", "{}");
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "COVER_SAVE_FAILED", message(exception));
        }
    }

    public void reset(UUID bookId, Principal principal) {
        UUID actor = users.findByUsername(principal.getName()).orElseThrow().id();
        books.findPreferredFile(bookId).orElseThrow(() -> ApiException.notFound("BOOK_NOT_FOUND", "未找到这本书。"));
        covers.reset(bookId);
        audit.record(actor, "BOOK_COVER_RESET", "BOOK", bookId.toString(), null, null, null, null, "SUCCEEDED", "{}");
    }

    private byte[] normalize(byte[] bytes) {
        if (bytes == null || bytes.length == 0 || bytes.length > properties.upload().maxCoverSize()) throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "COVER_SIZE_LIMIT", "封面为空或超过大小限制。");
        try {
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(bytes));
            if (source == null || source.getWidth() > 12_000 || source.getHeight() > 12_000 || (long) source.getWidth() * source.getHeight() > 80_000_000L) throw new IllegalArgumentException("封面格式不支持或像素过大");
            double ratio = 2.0 / 3.0;
            int width = source.getWidth(); int height = source.getHeight();
            if ((double) width / height > ratio) width = (int) Math.round(height * ratio); else height = (int) Math.round(width / ratio);
            BufferedImage target = new BufferedImage(800, 1200, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = target.createGraphics();
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.drawImage(source, 0, 0, 800, 1200, (source.getWidth() - width) / 2, (source.getHeight() - height) / 2,
                    (source.getWidth() + width) / 2, (source.getHeight() + height) / 2, null);
            graphics.dispose();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(target, "JPEG", output);
            return output.toByteArray();
        } catch (Exception exception) { throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_COVER", message(exception)); }
    }

    private Path safeDirectories(Path root, Path target) throws Exception {
        Path current = root;
        for (Path segment : root.relativize(target.normalize())) {
            current = current.resolve(segment);
            if (Files.exists(current, LinkOption.NOFOLLOW_LINKS)) {
                if (Files.isSymbolicLink(current) || !Files.isDirectory(current, LinkOption.NOFOLLOW_LINKS)) throw new IllegalArgumentException("封面目录不安全");
            } else Files.createDirectory(current);
            if (!current.toRealPath().startsWith(root)) throw new IllegalArgumentException("封面目录越过书库");
        }
        return current;
    }
    private String message(Exception exception) { return exception.getMessage() == null ? "封面处理失败" : exception.getMessage(); }
}
