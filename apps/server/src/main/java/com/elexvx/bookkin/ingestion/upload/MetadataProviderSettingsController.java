package com.elexvx.bookkin.ingestion.upload;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/metadata-providers")
@PreAuthorize("hasAnyRole('OWNER','ADMIN')")
public class MetadataProviderSettingsController {
    private final MetadataProviderSettingsService settings;

    public MetadataProviderSettingsController(MetadataProviderSettingsService settings) {
        this.settings = settings;
    }

    @GetMapping
    MetadataProviderSettingsService.MetadataProviderSettingsView view(Principal principal) {
        return settings.view(principal);
    }

    @PutMapping
    MetadataProviderSettingsService.MetadataProviderSettingsView update(
            @Valid @RequestBody UpdateMetadataProviderSettings input, Principal principal) {
        return settings.update(input.providers().stream()
                .map(provider -> new MetadataProviderSettingsService.ProviderSettingInput(provider.id(), provider.enabled()))
                .toList(), principal);
    }

    public record UpdateMetadataProviderSettings(@NotNull @Size(min = 1, max = 3) List<@NotNull @Valid ProviderSetting> providers) {}
    public record ProviderSetting(@NotBlank String id, @NotNull Boolean enabled) {}
}
