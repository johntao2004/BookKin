package io.github.johntao2004.bookkin.catalog;

import io.github.johntao2004.bookkin.common.ApiException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.security.Principal;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/display-books")
public class DisplayCatalogController {
    private final DisplayCatalogService display;
    private final BookRepository books;

    public DisplayCatalogController(DisplayCatalogService display, BookRepository books) {
        this.display = display;
        this.books = books;
    }

    @GetMapping
    DisplayCatalogRepository.DisplayBookPage list(@RequestParam(required = false) String q,
                                                   @RequestParam(required = false) String cursor,
                                                   @RequestParam(defaultValue = "60") int limit) {
        return display.list(q, cursor, limit);
    }

    @GetMapping("/{id}")
    DisplayCatalogRepository.DisplayBook get(@PathVariable UUID id) {
        return display.findPublic(id);
    }

    @GetMapping("/{id}/cover")
    ResponseEntity<FileSystemResource> cover(@PathVariable UUID id) {
        // Looking up the public relationship first is intentional: a private book's
        // cached cover must not become an anonymous enumeration endpoint.
        display.findPublic(id);
        var location = books.findCover(id).orElseThrow(() -> ApiException.notFound("COVER_NOT_FOUND", "尚未生成封面。"));
        Path root;
        Path cover;
        try {
            root = Path.of(location.canonicalRoot() == null ? location.configuredRoot() : location.canonicalRoot()).toRealPath();
            Path candidate = root.resolve(location.relativePath()).normalize();
            if (!candidate.startsWith(root) || Files.isSymbolicLink(candidate)
                    || !Files.isRegularFile(candidate, LinkOption.NOFOLLOW_LINKS)) {
                throw ApiException.notFound("COVER_NOT_FOUND", "封面缓存不存在。");
            }
            cover = candidate.toRealPath();
            if (!cover.startsWith(root)) throw ApiException.notFound("COVER_NOT_FOUND", "封面缓存不存在。");
        } catch (java.io.IOException | RuntimeException exception) {
            if (exception instanceof ApiException apiException) throw apiException;
            throw ApiException.notFound("COVER_NOT_FOUND", "封面缓存不存在。");
        }
        String lower = cover.getFileName().toString().toLowerCase(Locale.ROOT);
        MediaType type = lower.endsWith(".png") ? MediaType.IMAGE_PNG
                : lower.endsWith(".webp") ? MediaType.parseMediaType("image/webp") : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok().contentType(type)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                .body(new FileSystemResource(cover));
    }

    @PostMapping
    DisplayCatalogRepository.DisplayBook add(@Valid @RequestBody AddRequest input, Principal principal) {
        return display.add(input.bookId(), input.revision(), principal);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> remove(@PathVariable UUID id, @RequestParam @PositiveOrZero long revision, Principal principal) {
        display.remove(id, revision, principal);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/order")
    DisplayCatalogRepository.DisplayBookPage reorder(@Valid @RequestBody OrderRequest input, Principal principal) {
        return display.reorder(input.bookIds(), input.revision(), principal);
    }

    public record AddRequest(@NotNull UUID bookId, @PositiveOrZero long revision) {}

    public record OrderRequest(@PositiveOrZero long revision, @NotNull List<@NotNull UUID> bookIds) {}
}
