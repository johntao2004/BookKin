package io.github.johntao2004.bookkin.catalog;

import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.users.UserRepository;
import java.security.Principal;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/books")
public class BookController {
    private final BookRepository books;
    private final UserRepository users;

    public BookController(BookRepository books, UserRepository users) {
        this.books = books;
        this.users = users;
    }

    @GetMapping
    BookRepository.BookPage list(@RequestParam(required = false) String q,
                                 @RequestParam(required = false) BookFormat format,
                                 @RequestParam(defaultValue = "RECENT") BookSort sort,
                                 @RequestParam(required = false) String cursor,
                                 @RequestParam(defaultValue = "60") int limit,
                                 Principal principal) {
        return books.list(userId(principal), q, format, sort, cursor, limit);
    }

    @GetMapping("/{id}")
    BookRepository.BookSummary get(@PathVariable UUID id, Principal principal) {
        return books.findSummary(userId(principal), id)
                .orElseThrow(() -> ApiException.notFound("BOOK_NOT_FOUND", "未找到这本书。"));
    }

    @GetMapping("/{id}/cover")
    ResponseEntity<FileSystemResource> cover(@PathVariable UUID id) {
        var location = books.findCover(id).orElseThrow(() -> ApiException.notFound("COVER_NOT_FOUND", "尚未生成封面。"));
        Path root;
        Path cover;
        try {
            root = Path.of(location.canonicalRoot() == null ? location.configuredRoot() : location.canonicalRoot()).toRealPath();
            Path candidate = root.resolve(location.relativePath()).normalize();
            if (!candidate.startsWith(root) || java.nio.file.Files.isSymbolicLink(candidate)
                    || !java.nio.file.Files.isRegularFile(candidate, LinkOption.NOFOLLOW_LINKS)) {
                throw ApiException.notFound("COVER_NOT_FOUND", "封面缓存不存在。");
            }
            cover = candidate.toRealPath();
            if (!cover.startsWith(root)) throw ApiException.notFound("COVER_NOT_FOUND", "封面缓存不存在。");
        } catch (java.io.IOException exception) {
            throw ApiException.notFound("COVER_NOT_FOUND", "封面缓存不存在。");
        }
        String lower = cover.getFileName().toString().toLowerCase(java.util.Locale.ROOT);
        MediaType type = lower.endsWith(".png") ? MediaType.IMAGE_PNG
                : lower.endsWith(".webp") ? MediaType.parseMediaType("image/webp") : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok().contentType(type).cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(30)).cachePublic())
                .body(new FileSystemResource(cover));
    }

    private UUID userId(Principal principal) {
        return users.findByUsername(principal.getName()).orElseThrow().id();
    }
}
