package io.github.johntao2004.bookkin.reading;

import io.github.johntao2004.bookkin.catalog.BookRepository;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.filemanagement.FileLeaseRepository;
import io.github.johntao2004.bookkin.filemanagement.PathPolicy;
import io.github.johntao2004.bookkin.ingestion.LibraryRootRepository;
import io.github.johntao2004.bookkin.users.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.security.Principal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/books/{bookId}")
public class ReadingController {
    private final BookRepository books;
    private final LibraryRootRepository roots;
    private final UserRepository users;
    private final ReadingRepository positions;
    private final FileLeaseRepository leases;
    private final PathPolicy pathPolicy;

    public ReadingController(BookRepository books, LibraryRootRepository roots, UserRepository users,
                             ReadingRepository positions, FileLeaseRepository leases, PathPolicy pathPolicy) {
        this.books = books;
        this.roots = roots;
        this.users = users;
        this.positions = positions;
        this.leases = leases;
        this.pathPolicy = pathPolicy;
    }

    @GetMapping("/position")
    ReadingRepository.ReadingPosition position(@PathVariable UUID bookId, Principal principal) {
        return positions.find(userId(principal), bookId).orElse(null);
    }

    @PutMapping("/position")
    ReadingRepository.ReadingPosition savePosition(@PathVariable UUID bookId, @Valid @RequestBody PositionRequest input,
                                                    Principal principal) {
        books.findPreferredFile(bookId).orElseThrow(() -> ApiException.notFound("BOOK_NOT_FOUND", "未找到这本书。"));
        return positions.save(userId(principal), bookId, input.locator(), input.progress(), input.deviceId());
    }

    @PostMapping("/reading-time")
    ReadingRepository.WeeklyReadingStats addReadingTime(@PathVariable UUID bookId,
                                                        @Valid @RequestBody ReadingTimeRequest input,
                                                        Principal principal) {
        books.findPreferredFile(bookId).orElseThrow(() -> ApiException.notFound("BOOK_NOT_FOUND", "未找到这本书。"));
        UUID userId = userId(principal);
        positions.addReadingTime(userId, bookId, LocalDate.now(), input.seconds());
        return positions.weeklyStats(userId, LocalDate.now());
    }

    @GetMapping("/content")
    void content(@PathVariable UUID bookId,
                 @RequestHeader(value = HttpHeaders.RANGE, required = false) String range,
                 HttpServletRequest request,
                 HttpServletResponse response) throws Exception {
        var file = books.findPreferredFile(bookId).orElseThrow(() -> ApiException.notFound("BOOK_FILE_NOT_FOUND", "书籍文件不存在。"));
        String holder = "http:" + request.getSession().getId() + ":" + UUID.randomUUID();
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

    private UUID userId(Principal principal) {
        return users.findByUsername(principal.getName()).orElseThrow().id();
    }

    public record PositionRequest(@NotBlank String locator,
                                  @DecimalMin("0") @DecimalMax("1") BigDecimal progress,
                                  String deviceId) {}
    public record ReadingTimeRequest(@Min(1) @Max(60) int seconds) {}
}
