package com.elexvx.silvae.ai;

import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Minimal authenticated status endpoint used to explain unavailable AI actions without exposing settings. */
@RestController
@Profile("api")
@RequestMapping("/api/v1/ai/status")
@PreAuthorize("isAuthenticated()")
public class AiAvailabilityController {
    private final AiSettingsService settings;

    public AiAvailabilityController(AiSettingsService settings) {
        this.settings = settings;
    }

    @GetMapping
    AiSettingsService.AiAvailabilityView status() {
        return settings.availability();
    }
}
