package io.github.johntao2004.bookkin.reading;

import io.github.johntao2004.bookkin.catalog.BookRepository;
import io.github.johntao2004.bookkin.catalog.DisplayCatalogService;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.filemanagement.FileLeaseRepository;
import io.github.johntao2004.bookkin.filemanagement.PathPolicy;
import io.github.johntao2004.bookkin.ingestion.LibraryRootRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
    void content(@PathVariable UUID bookId,
                 @RequestHeader(value = HttpHeaders.RANGE, required = false) String range,
                 HttpServletRequest request,
                 HttpServletResponse response) throws Exception {
        var publicBook = display.findPublic(bookId);
        if (!publicBook.available()) throw ApiException.notFound("BOOK_FILE_NOT_FOUND", "书籍文件暂不可用。");
        var file = books.findPreferredFile(bookId)
                .orElseThrow(() -> ApiException.notFound("BOOK_FILE_NOT_FOUND", "书籍文件不存在。"));
        var session = request.getSession(false);
        String holder = "public-http:" + (session == null ? "anonymous" : session.getId()) + ":" + UUID.randomUUID();
        var lease = leases.acquireRead(file.id(), holder, Duration.ofMinutes(15));
        Path path;
        long size;
        BookContentResponse.ByteRange selected;
        try {
            var root = roots.findById(file.libraryRootId()).orElseThrow();
            Path rootPath = Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath());
            path = pathPolicy.resolveExisting(rootPath, file.relativePath());
            size = java.nio.file.Files.size(path);
            selected = BookContentResponse.select(response, range, size);
        } catch (Exception exception) {
            leases.release(lease);
            throw exception;
        }
        try {
            BookContentResponse.write(response, path, file.format(), selected, size,
                    HttpMethod.HEAD.matches(request.getMethod()));
        } finally {
            leases.release(lease);
        }
    }
}
