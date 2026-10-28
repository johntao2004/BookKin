package com.elexvx.bookkin.catalog.knowledge;

import java.security.Principal;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/knowledge/books")
public class KnowledgeBookDraftController {
    private final KnowledgeDraftService drafts;

    public KnowledgeBookDraftController(KnowledgeDraftService drafts) {
        this.drafts = drafts;
    }

    @GetMapping("/{bookId}")
    public KnowledgeDraft get(@PathVariable UUID bookId, Principal principal) {
        return drafts.readBook(bookId, principal);
    }
}
