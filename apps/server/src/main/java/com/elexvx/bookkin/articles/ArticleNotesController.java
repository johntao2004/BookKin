package com.elexvx.bookkin.articles;

import java.security.Principal;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/articles")
public class ArticleNotesController {
    private final ArticleNotesService notes;

    public ArticleNotesController(ArticleNotesService notes) {
        this.notes = notes;
    }

    @GetMapping("/notes")
    public ResponseEntity<List<ArticleNotesService.ArticleNotes>> notes(Principal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(notes.notes(principal));
    }
}
