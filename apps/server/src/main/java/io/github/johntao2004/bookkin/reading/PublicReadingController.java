package io.github.johntao2004.bookkin.reading;

import io.github.johntao2004.bookkin.catalog.BookFormat;
import io.github.johntao2004.bookkin.catalog.BookRepository;
import io.github.johntao2004.bookkin.catalog.DisplayCatalogService;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.filemanagement.FileLeaseRepository;
import io.github.johntao2004.bookkin.filemanagement.PathPolicy;
import io.github.johntao2004.bookkin.ingestion.LibraryRootRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@Profile("api")
@RequestMapping("/api/v1/display-books/{bookId}")
public class PublicReadingController {
    private final DisplayCatalogService display;
    private final BookRepository books;
    private final LibraryRootRepository roots;
    private final FileLeaseRepository leases;
    private final PathPolicy pathPolicy;

    public PublicReadingController(DisplayCatalogService display, BookRepository books, LibraryRootRepository roots,
                                   FileLeaseRepository leases, PathPolicy pathPolicy) {
        this.display = display;
        this.books = books;
        this.roots = roots;
        this.leases = leases;
        this.pathPolicy = pathPolicy;
    }

    @GetMapping("/content")
    ResponseEntity<StreamingResponseBody> content(@PathVariable UUID bookId,
                                                  @RequestHeader(value = HttpHeaders.RANGE, required = false) String range,
                                                  HttpServletRequest request) throws Exception {
        var publicBook = display.findPublic(bookId);
        if (!publicBook.available()) throw ApiException.notFound("BOOK_FILE_NOT_FOUND", "书籍文件暂不可用。");
        var file = books.findPreferredFile(bookId)
                .orElseThrow(() -> ApiException.notFound("BOOK_FILE_NOT_FOUND", "书籍文件不存在。"));
        var session = request.getSession(false);
        String holder = "public-http:" + (session == null ? "anonymous" : session.getId()) + ":" + UUID.randomUUID();
        var lease = leases.acquireRead(file.id(), holder, Duration.ofMinutes(15));
        Path path;
        long size;
        ByteRange selected;
        try {
            var root = roots.findById(file.libraryRootId()).orElseThrow();
            Path rootPath = Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath());
            path = pathPolicy.resolveExisting(rootPath, file.relativePath());
            size = java.nio.file.Files.size(path);
            selected = ByteRange.parse(range, size);
        } catch (Exception exception) {
            leases.release(lease);
            throw exception;
        }
        StreamingResponseBody body = output -> {
            try {
                stream(path, selected.start(), selected.length(), output);
            } finally {
                leases.release(lease);
            }
        };
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.ACCEPT_RANGES, "bytes");
        headers.setContentLength(selected.length());
        headers.setContentType(file.format() == BookFormat.EPUB
                ? MediaType.parseMediaType("application/epub+zip") : MediaType.APPLICATION_PDF);
        if (selected.partial()) headers.set(HttpHeaders.CONTENT_RANGE,
                "bytes " + selected.start() + "-" + selected.end() + "/" + size);
        return new ResponseEntity<>(body, headers, selected.partial() ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK);
    }

    private void stream(Path path, long start, long length, OutputStream output) throws java.io.IOException {
        try (FileChannel channel = FileChannel.open(path, StandardOpenOption.READ)) {
            channel.position(start);
            ByteBuffer buffer = ByteBuffer.allocate(256 * 1024);
            long remaining = length;
            while (remaining > 0) {
                buffer.clear();
                buffer.limit((int) Math.min(buffer.capacity(), remaining));
                int read = channel.read(buffer);
                if (read < 0) break;
                output.write(buffer.array(), 0, read);
                remaining -= read;
            }
        }
    }

    private record ByteRange(long start, long end, boolean partial) {
        long length() { return end - start + 1; }

        static ByteRange parse(String header, long size) {
            if (size <= 0) throw ApiException.notFound("BOOK_FILE_NOT_FOUND", "书籍文件为空。");
            if (header == null || header.isBlank()) return new ByteRange(0, size - 1, false);
            if (!header.startsWith("bytes=") || header.contains(",")) {
                throw new ApiException(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE, "INVALID_RANGE", "仅支持单段 HTTP Range。");
            }
            String[] parts = header.substring(6).split("-", -1);
            try {
                long start;
                long end;
                if (parts[0].isBlank()) {
                    long suffix = Long.parseLong(parts[1]);
                    start = Math.max(0, size - suffix);
                    end = size - 1;
                } else {
                    start = Long.parseLong(parts[0]);
                    end = parts[1].isBlank() ? size - 1 : Math.min(size - 1, Long.parseLong(parts[1]));
                }
                if (start < 0 || start > end || start >= size) throw new NumberFormatException();
                return new ByteRange(start, end, true);
            } catch (NumberFormatException exception) {
                throw new ApiException(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE, "INVALID_RANGE", "请求的字节范围无效。");
            }
        }
    }
}
