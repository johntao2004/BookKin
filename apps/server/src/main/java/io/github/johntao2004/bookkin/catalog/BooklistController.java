package io.github.johntao2004.bookkin.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/booklists")
public class BooklistController {
    private final BooklistService booklists;

    public BooklistController(BooklistService booklists) {
        this.booklists = booklists;
    }

    @GetMapping
    BooklistRepository.BooklistList list(@RequestParam(required = false) String q, Principal principal) {
        return booklists.list(q, principal);
    }

    @PostMapping
    BooklistRepository.BooklistDetail create(@Valid @RequestBody CreateBooklistRequest input, Principal principal) {
        return booklists.create(input.kind(), input.visibility(), input.title(), input.description(), principal);
    }

    @GetMapping("/{id}")
    BooklistRepository.BooklistDetail get(@PathVariable UUID id, Principal principal) {
        return booklists.get(id, principal);
    }

    @PatchMapping("/{id}")
    BooklistRepository.BooklistDetail update(@PathVariable UUID id,
                                             @Valid @RequestBody UpdateBooklistRequest input,
                                             Principal principal) {
        return booklists.update(id, input.title(), input.description(), input.visibility(), input.revision(), principal);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id, @RequestParam @PositiveOrZero long revision,
                                Principal principal) {
        booklists.delete(id, revision, principal);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/books")
    BrowseBookPage books(@PathVariable UUID id,
                         @RequestParam(required = false) String q,
                         @RequestParam(required = false) BookFormat format,
                         @RequestParam(required = false) String cursor,
                         @RequestParam(defaultValue = "36") int limit,
                         Principal principal) {
        return booklists.books(id, q, format, cursor, limit, principal);
    }

    @PostMapping("/{id}/books")
    BooklistRepository.BooklistDetail addBooks(@PathVariable UUID id,
                                               @Valid @RequestBody AddBooklistBooksRequest input,
                                               Principal principal) {
        return booklists.addBooks(id, input.bookIds(), input.revision(), principal);
    }

    @DeleteMapping("/{id}/books/{bookId}")
    BooklistRepository.BooklistDetail removeBook(@PathVariable UUID id, @PathVariable UUID bookId,
                                                 @RequestParam @PositiveOrZero long revision,
                                                 Principal principal) {
        return booklists.removeBook(id, bookId, revision, principal);
    }

    @PutMapping("/{id}/order")
    BooklistRepository.BooklistDetail reorder(@PathVariable UUID id,
                                              @Valid @RequestBody ReorderBooklistRequest input,
                                              Principal principal) {
        return booklists.reorder(id, input.bookIds(), input.revision(), principal);
    }

    public record CreateBooklistRequest(@NotBlank @Size(max = 240) String title,
                                        @Size(max = 4000) String description,
                                        @NotNull BooklistKind kind,
                                        @NotNull BooklistVisibility visibility) {
    }

    public record UpdateBooklistRequest(@NotBlank @Size(max = 240) String title,
                                        @Size(max = 4000) String description,
                                        @NotNull BooklistVisibility visibility,
                                        @PositiveOrZero long revision) {
    }

    public record AddBooklistBooksRequest(@NotNull List<@NotNull UUID> bookIds,
                                          @PositiveOrZero long revision) {
    }

    public record ReorderBooklistRequest(@NotNull List<@NotNull UUID> bookIds,
                                         @PositiveOrZero long revision) {
    }
}
