package io.github.johntao2004.bookkin.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
@RequestMapping("/api/v1")
public class CategoryController {
    private final CategoryService categories;

    public CategoryController(CategoryService categories) {
        this.categories = categories;
    }

    @GetMapping("/categories")
    CategoryRepository.CategoryList list(@RequestParam(required = false) String q, Principal principal) {
        return categories.list(q, principal);
    }

    @PostMapping("/categories")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    CategoryRepository.CategoryDetail create(@Valid @RequestBody CategoryRequest input, Principal principal) {
        return categories.create(input.name(), input.description(), principal);
    }

    @GetMapping("/categories/{id}")
    CategoryRepository.CategoryDetail get(@PathVariable UUID id, Principal principal) {
        return categories.get(id, principal);
    }

    @PatchMapping("/categories/{id}")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    CategoryRepository.CategoryDetail update(@PathVariable UUID id, @Valid @RequestBody CategoryRequest input,
                                             Principal principal) {
        return categories.update(id, input.name(), input.description(), principal);
    }

    @DeleteMapping("/categories/{id}")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    ResponseEntity<Void> delete(@PathVariable UUID id, Principal principal) {
        categories.delete(id, principal);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/categories/order")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    CategoryRepository.CategoryList reorder(@Valid @RequestBody CategoryOrderRequest input, Principal principal) {
        return categories.reorder(input.categoryIds(), principal);
    }

    @GetMapping("/categories/{id}/books")
    BrowseBookPage books(@PathVariable UUID id,
                         @RequestParam(required = false) String q,
                         @RequestParam(required = false) BookFormat format,
                         @RequestParam(defaultValue = "RECENT") BookSort sort,
                         @RequestParam(required = false) String cursor,
                         @RequestParam(defaultValue = "36") int limit,
                         Principal principal) {
        return categories.books(id, q, format, sort, cursor, limit, principal);
    }

    @GetMapping("/books/{bookId}/categories")
    CategoryRepository.CategoryList categoriesForBook(@PathVariable UUID bookId, Principal principal) {
        return categories.categoriesForBook(bookId, principal);
    }

    @PutMapping("/books/{bookId}/categories")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    CategoryRepository.CategoryList replaceBookCategories(@PathVariable UUID bookId,
                                                          @Valid @RequestBody BookCategoriesRequest input,
                                                          Principal principal) {
        return categories.replaceBookCategories(bookId, input.categoryIds(), principal);
    }

    public record CategoryRequest(@NotBlank @Size(max = 160) String name,
                                  @Size(max = 2000) String description) {
    }

    public record CategoryOrderRequest(@NotNull List<@NotNull UUID> categoryIds) {
    }

    public record BookCategoriesRequest(@NotNull List<@NotNull UUID> categoryIds) {
    }
}
