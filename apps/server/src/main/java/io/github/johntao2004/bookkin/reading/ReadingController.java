package io.github.johntao2004.bookkin.reading;

import io.github.johntao2004.bookkin.catalog.BookRepository;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.filemanagement.FileLeaseRepository;
import io.github.johntao2004.bookkin.filemanagement.PathPolicy;
import io.github.johntao2004.bookkin.ingestion.LibraryRootRepository;
import io.github.johntao2004.bookkin.users.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.Principal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

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
    ResponseEntity<StreamingResponseBody> content(@PathVariable UUID bookId,
                                                  @RequestHeader(value = HttpHeaders.RANGE, required = false) String range,
                                                  HttpServletRequest request) throws Exception {
        var file = books.findPreferredFile(bookId).orElseThrow(() -> ApiException.notFound("BOOK_FILE_NOT_FOUND", "书籍文件不存在。"));
        String holder = "http:" + request.getSession().getId() + ":" + UUID.randomUUID();
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
        headers.setContentType(file.format() == io.github.johntao2004.bookkin.catalog.BookFormat.EPUB
                ? MediaType.parseMediaType("application/epub+zip") : MediaType.APPLICATION_PDF);
        if (selected.partial()) headers.set(HttpHeaders.CONTENT_RANGE, "bytes " + selected.start() + "-" + selected.end() + "/" + size);
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

    private UUID userId(Principal principal) {
        return users.findByUsername(principal.getName()).orElseThrow().id();
    }

    public record PositionRequest(@NotBlank String locator,
                                  @DecimalMin("0") @DecimalMax("1") BigDecimal progress,
                                  String deviceId) {}
    public record ReadingTimeRequest(@Min(1) @Max(60) int seconds) {}

    private record ByteRange(long start, long end, boolean partial) {
        long length() { return end - start + 1; }
        static ByteRange parse(String header, long size) {
            if (header == null || header.isBlank()) return new ByteRange(0, size - 1, false);
            if (!header.startsWith("bytes=") || header.contains(",")) throw new ApiException(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE, "INVALID_RANGE", "仅支持单段 HTTP Range。");
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
