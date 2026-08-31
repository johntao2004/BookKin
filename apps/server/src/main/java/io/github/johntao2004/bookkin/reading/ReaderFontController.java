package io.github.johntao2004.bookkin.reading;

import io.github.johntao2004.bookkin.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.io.IOException;
import java.security.Principal;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/reader-fonts")
public class ReaderFontController {
    private final ReaderFontService service;

    public ReaderFontController(ReaderFontService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    ReaderFontList list(@RequestParam(defaultValue = "false") boolean includeDisabled, Principal principal) {
        if (includeDisabled && !isManager(principal)) throw ApiException.forbidden("FONT_ADMIN_REQUIRED", "只有主人和管理员可以查看停用字体。");
        return new ReaderFontList(service.list(includeDisabled));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    ReaderFontService.ReaderFontView create(@Valid @RequestBody CreateReaderFont input, Principal principal) {
        return service.create(input.displayName(), input.kind(), input.filename(), input.sizeBytes(), input.licenseNote(), principal);
    }

    @PutMapping(path = "/{id}/content", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    ReaderFontService.ReaderFontView content(@PathVariable UUID id, HttpServletRequest request, Principal principal) throws IOException {
        return service.receive(id, request.getContentLengthLong(), request.getInputStream(), principal);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    ReaderFontService.ReaderFontView status(@PathVariable UUID id, @Valid @RequestBody UpdateReaderFont input, Principal principal) {
        return service.setStatus(id, input.status(), principal);
    }

    @GetMapping("/{id}/content")
    @PreAuthorize("isAuthenticated()")
    ResponseEntity<FileSystemResource> content(@PathVariable UUID id) {
        ReaderFontService.FontContent content = service.content(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.mimeType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePrivate().mustRevalidate())
                .body(content.resource());
    }

    private boolean isManager(Principal principal) {
        return principal instanceof org.springframework.security.core.Authentication authentication
                && authentication.getAuthorities().stream().anyMatch(authority -> authority.getAuthority().equals("ROLE_OWNER") || authority.getAuthority().equals("ROLE_ADMIN"));
    }

    public record ReaderFontList(List<ReaderFontService.ReaderFontView> items) {}

    public record CreateReaderFont(
            @NotBlank @Pattern(regexp = "SERIF|SANS") String kind,
            @NotBlank String filename,
            @Positive long sizeBytes,
            String displayName,
            String licenseNote) {}

    public record UpdateReaderFont(@NotBlank @Pattern(regexp = "ENABLED|DISABLED") String status) {}
}
