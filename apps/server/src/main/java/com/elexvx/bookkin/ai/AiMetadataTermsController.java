package com.elexvx.bookkin.ai;

import com.elexvx.bookkin.catalog.terms.MetadataTermKind;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.security.Principal;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("api")
@RequestMapping("/api/v1/ai/metadata-terms")
public class AiMetadataTermsController {
    private final AiBookClassificationService service;
    public AiMetadataTermsController(AiBookClassificationService service) { this.service = service; }
    public record Input(@NotNull MetadataTermKind kind, @NotNull AiBookClassificationService.Source source,
                        @NotNull UUID id, boolean consent) {}
    @PostMapping
    AiBookClassificationService.TermSuggestions generate(@Valid @RequestBody Input input, Principal principal) throws Exception {
        return service.suggestTerms(input, principal);
    }
}
