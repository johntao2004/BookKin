package com.elexvx.bookkin.ingestion.upload;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.security.Principal;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@PreAuthorize("hasAnyRole('OWNER','ADMIN')")
public class UploadPrecheckController {
    private final UploadPrecheckService service;
    public UploadPrecheckController(UploadPrecheckService service) { this.service = service; }

    @PostMapping("/api/v1/book-uploads/precheck")
    public ResponseEntity<Result> check(@Valid @RequestBody Request input, Principal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new Result(service.check(input.fingerprint(), input.sizeBytes(), principal)));
    }
    public record Request(@NotBlank @Pattern(regexp = "sha256:[0-9a-f]{64}") String fingerprint,
                          @Positive long sizeBytes) {}
    public record Result(UploadPrecheckService.Match match) {}
}
