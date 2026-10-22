package com.elexvx.bookkin.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
public class BookReviewController {
    private final BookReviewService reviews;

    public BookReviewController(BookReviewService reviews) {
        this.reviews = reviews;
    }

    @GetMapping("/api/v1/books/{bookId}/reviews")
    public ResponseEntity<List<BookReviewRepository.BookReview>> list(@PathVariable UUID bookId, Principal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reviews.list(bookId, principal));
    }

    @PostMapping("/api/v1/books/{bookId}/reviews")
    public ResponseEntity<BookReviewRepository.BookReview> create(@PathVariable UUID bookId,
                                                                  @Valid @RequestBody ReviewInput input,
                                                                  Principal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(reviews.create(bookId, input.title(), input.markdown(), input.visibility(), principal));
    }

    @PutMapping("/api/v1/book-reviews/{id}")
    public ResponseEntity<BookReviewRepository.BookReview> update(@PathVariable UUID id,
                                                                  @Valid @RequestBody ReviewUpdate input,
                                                                  Principal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(reviews.update(id, input.title(), input.markdown(), input.visibility(), input.revision(), principal));
    }

    public record ReviewInput(@NotBlank @Size(max = 200) String title,
                              @NotBlank @Size(max = 500_000) String markdown,
                              ReviewVisibility visibility) {}

    public record ReviewUpdate(@NotBlank @Size(max = 200) String title,
                               @NotBlank @Size(max = 500_000) String markdown,
                               ReviewVisibility visibility,
                               @Min(1) long revision) {}
}
