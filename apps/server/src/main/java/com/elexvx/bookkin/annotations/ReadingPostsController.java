package com.elexvx.bookkin.annotations;

import com.elexvx.bookkin.catalog.ReviewVisibility;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("api")
@RequestMapping("/api/v1/reading-posts")
public class ReadingPostsController {
    private final ReadingPostsService posts;
    public ReadingPostsController(ReadingPostsService posts) { this.posts=posts; }

    @GetMapping
    public ResponseEntity<ReadingPostsService.Page> mine(@RequestParam(defaultValue="ALL") ReadingPostsService.Kind kind,
                                                         @RequestParam(required=false) String cursor, Principal principal) {
        return response(posts.mine(kind,cursor,principal));
    }
    @GetMapping("/{kind}/{id}")
    public ResponseEntity<ReadingPostsService.Post> get(@PathVariable ReadingPostsService.Kind kind,@PathVariable UUID id,Principal principal) {
        return response(posts.get(kind,id,principal));
    }
    @PostMapping
    public ResponseEntity<ReadingPostsService.Post> create(@Valid @RequestBody Create input,Principal principal) {
        return response(posts.create(input.kind(),input.sourceId(),input.title(),input.markdown(),input.visibility(),principal));
    }
    @PutMapping("/{kind}/{id}")
    public ResponseEntity<ReadingPostsService.Post> update(@PathVariable ReadingPostsService.Kind kind,@PathVariable UUID id,
                                                          @Valid @RequestBody Update input,Principal principal) {
        return response(posts.update(kind,id,input.title(),input.markdown(),input.visibility(),input.revision(),principal));
    }
    private <T> ResponseEntity<T> response(T body) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body); }
    public record Create(@NotNull ReadingPostsService.Kind kind,@NotNull UUID sourceId,@NotBlank @Size(max=200) String title,
                         @NotBlank @Size(max=500000) String markdown,ReviewVisibility visibility) {}
    public record Update(@NotBlank @Size(max=200) String title,@NotBlank @Size(max=500000) String markdown,
                         ReviewVisibility visibility,@Min(1) long revision) {}
}
