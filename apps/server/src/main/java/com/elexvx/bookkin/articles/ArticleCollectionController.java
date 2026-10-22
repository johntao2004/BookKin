package com.elexvx.bookkin.articles;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
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

/** Authenticated HTTP contract for article collections. */
@RestController
@Profile("api")
@RequestMapping("/api/v1/article-collections")
public class ArticleCollectionController {
    private final ArticleCollectionService service;

    public ArticleCollectionController(ArticleCollectionService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<ArticleCollectionService.ListResponse> list(@RequestParam(required = false) String q, Principal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(q, principal));
    }

    @PostMapping
    public ResponseEntity<ArticleCollectionService.Detail> create(@Valid @RequestBody Create input, Principal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(service.create(input.title(), input.description(), input.visibility(), principal));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ArticleCollectionService.Detail> get(@PathVariable String id, Principal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.get(id, principal));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ArticleCollectionService.Detail> update(@PathVariable String id,
                                                                  @Valid @RequestBody Update input,
                                                                  Principal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.update(id, input.title(),
                input.description(), input.visibility(), input.revision(), principal));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id, @RequestParam @Positive long revision, Principal principal) {
        service.delete(id, revision, principal);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @PostMapping("/{id}/articles")
    public ResponseEntity<ArticleCollectionService.Detail> addArticles(@PathVariable String id,
                                                                       @Valid @RequestBody ArticleIds input,
                                                                       Principal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(service.addArticles(id, input.articleIds(), input.revision(), principal));
    }

    @DeleteMapping("/{id}/articles/{articleId}")
    public ResponseEntity<ArticleCollectionService.Detail> removeArticle(@PathVariable String id,
                                                                         @PathVariable String articleId,
                                                                         @RequestParam @Positive long revision,
                                                                         Principal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(service.removeArticle(id, articleId, revision, principal));
    }

    @PutMapping("/{id}/order")
    public ResponseEntity<ArticleCollectionService.Detail> reorder(@PathVariable String id,
                                                                   @Valid @RequestBody ArticleIds input,
                                                                   Principal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(service.reorder(id, input.articleIds(), input.revision(), principal));
    }

    public record Create(@NotBlank @Size(min = 1, max = 240) String title,
                         @Size(max = 4000) String description,
                         @NotBlank String visibility) {}
    public record Update(@NotBlank @Size(min = 1, max = 240) String title,
                         @Size(max = 4000) String description,
                         @NotBlank String visibility,
                         @Positive long revision) {}
    public record ArticleIds(@NotNull @Size(max = ArticleCollectionService.MAX_ARTICLES) List<@NotNull UUID> articleIds,
                             @Positive long revision) {}
}
