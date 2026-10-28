package com.elexvx.bookkin.ai;

import com.elexvx.bookkin.catalog.knowledge.KnowledgeDraft;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.security.Principal;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/ai/book-knowledge")
public class AiBookKnowledgeController {
    private final AiBookKnowledgeService service;

    public AiBookKnowledgeController(AiBookKnowledgeService service) {
        this.service = service;
    }

    @PostMapping
    public KnowledgeDraft generate(@Valid @RequestBody Input input, Principal principal) throws Exception {
        return service.generate(input, principal);
    }

    public record Input(@NotNull AiBookClassificationService.Source source, @NotNull UUID id, boolean consent) {}
}
