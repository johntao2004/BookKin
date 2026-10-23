package com.elexvx.bookkin.ai;

import java.security.Principal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

/** Contextual assistance has source-level authorization, independent of platform administration. */
@RestController
@Profile("api")
@RequestMapping("/api/v1/ai/assistance")
public class AiAssistanceController {
    private final AiAssistanceService service;
    public AiAssistanceController(AiAssistanceService service) { this.service = service; }
    @PostMapping
    AiAssistanceService.Result assist(@Valid @RequestBody Input input, Principal principal) throws Exception {
        return service.assist(input, principal);
    }
    public record Input(@NotNull AiAssistanceService.SourceType source, @Size(max = 36) String id,
                        @NotNull AiAssistanceService.Action action, @Size(max = 1000) String question,
                        @Size(max = 20000) String draft, boolean consent) {}
}
