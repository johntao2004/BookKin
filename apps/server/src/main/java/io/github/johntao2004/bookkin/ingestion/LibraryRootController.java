package io.github.johntao2004.bookkin.ingestion;

import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/library-roots")
@PreAuthorize("hasAnyRole('OWNER','ADMIN')")
public class LibraryRootController {
    private final LibraryRootRepository roots;
    private final LibraryRootRegistrationService registration;
    private final LibraryRootCapabilityService capabilities;

    public LibraryRootController(LibraryRootRepository roots, LibraryRootRegistrationService registration, LibraryRootCapabilityService capabilities) {
        this.roots = roots; this.registration = registration; this.capabilities = capabilities;
    }

    @GetMapping
    RootList list() {
        return new RootList(roots.findAll());
    }

    @org.springframework.web.bind.annotation.PostMapping("/preview")
    Object preview(@org.springframework.web.bind.annotation.RequestBody Location input) { return registration.preview(input.path()); }
    @org.springframework.web.bind.annotation.PostMapping
    LibraryRoot create(@org.springframework.web.bind.annotation.RequestBody Registration input) { return registration.create(input.name(), input.path(), input.expectedFingerprint(), input.idempotencyKey()); }
    @org.springframework.web.bind.annotation.PostMapping("/check")
    RootList check() { capabilities.checkAll(); return new RootList(roots.findAll()); }
    @org.springframework.web.bind.annotation.ExceptionHandler(IllegalArgumentException.class)
    org.springframework.http.ResponseEntity<java.util.Map<String, String>> invalidLocation(IllegalArgumentException error) {
        return org.springframework.http.ResponseEntity.badRequest().body(java.util.Map.of("code", "INVALID_LIBRARY_LOCATION", "detail", error.getMessage()));
    }
    public record Location(String path) {}
    public record Registration(String name, String path, String expectedFingerprint, java.util.UUID idempotencyKey) {}
    public record RootList(List<LibraryRoot> items) {}
}
