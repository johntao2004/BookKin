package io.github.johntao2004.bookkin.ai;

import java.util.List;
import java.security.Principal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/ai")
@PreAuthorize("hasAnyRole('OWNER','ADMIN')")
public class AiController {
    private final AiMetadataService ai;
    private final AiSettingsService settings;

    public AiController(AiMetadataService ai, AiSettingsService settings) {
        this.ai = ai;
        this.settings = settings;
    }

    @GetMapping("/providers")
    AiProviderList providers() { return new AiProviderList(ai.providers()); }

    @GetMapping("/settings")
    AiSettingsService.AiSettingsView settings() { return settings.view(); }

    @PutMapping("/settings")
    AiSettingsService.AiSettingsView update(@Valid @RequestBody UpdateAiSettingsRequest input, Principal principal) {
        return settings.update(new AiSettingsService.AiSettingsInput(input.enabled(), input.autoMatch(), input.maxCandidates(),
                input.timeoutSeconds(), input.providers().stream().map(provider -> new AiSettingsService.AiProviderInput(
                        provider.id(), provider.label(), provider.type(), provider.enabled(), provider.baseUrl(), provider.model(),
                        provider.apiKey(), provider.clearApiKey())).toList()), principal.getName());
    }

    public record UpdateAiSettingsRequest(
            @NotNull Boolean enabled,
            @NotNull Boolean autoMatch,
            @NotNull @Min(1) @Max(10) Integer maxCandidates,
            @NotNull @Min(5) @Max(120) Integer timeoutSeconds,
            @NotNull @Size(max = 20) List<@Valid ProviderRequest> providers) {}

    public record ProviderRequest(
            @NotBlank @Size(max = 80) String id,
            @NotBlank @Size(max = 120) String label,
            @NotBlank @Size(max = 32) String type,
            boolean enabled,
            @Size(max = 500) String baseUrl,
            @Size(max = 200) String model,
            @Size(max = 500) String apiKey,
            boolean clearApiKey) {}

    public record AiProviderList(List<AiMetadataService.ProviderInfo> items) {}
}
