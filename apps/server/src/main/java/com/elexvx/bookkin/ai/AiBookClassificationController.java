package com.elexvx.bookkin.ai;

import java.security.Principal;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/ai/book-classification")
public class AiBookClassificationController {
    private final AiBookClassificationService service;

    public AiBookClassificationController(AiBookClassificationService service) { this.service = service; }

    @PostMapping
    AiBookClassificationService.Result classify(@Valid @RequestBody Input input, Principal principal) throws Exception {
        return service.classify(input, principal);
    }

    public record Input(@NotNull AiBookClassificationService.Source source, @NotNull UUID id, boolean consent) {}
}
