package com.elexvx.bookkin.users;

import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("api")
public class SiteSettingsController {
    private final SiteSettingsService service;
    public SiteSettingsController(SiteSettingsService service) {this.service=service;}
    @GetMapping("/api/v1/site-settings")
    public ResponseEntity<SiteSettingsService.Settings> get() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.current());
    }
    @PutMapping("/api/v1/site-settings")
    @PreAuthorize("hasRole('OWNER')")
    public SiteSettingsService.Settings save(Principal principal,@Valid @RequestBody SiteSettingsService.Settings settings) {
        return service.save(principal.getName(),settings);
    }
    @GetMapping(value={"/robots.txt","/api/v1/site-settings/robots.txt"},produces="text/plain;charset=UTF-8")
    public ResponseEntity<String> robots() {return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.robots());}
}
