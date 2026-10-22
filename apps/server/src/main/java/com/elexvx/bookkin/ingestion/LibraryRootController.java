package com.elexvx.bookkin.ingestion;

import java.util.List;
import com.elexvx.bookkin.filemanagement.ContentStorageService;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/library-roots")
@PreAuthorize("hasAnyRole('OWNER','ADMIN')")
// 展示配置书库及能力检查；保留旧登记端点以返回明确的功能关闭提示。
public class LibraryRootController {
    private final LibraryRootRepository roots;
    private final LibraryRootRegistrationService registration;
    private final LibraryRootCapabilityService capabilities;
    private final ContentStorageService content;

    public LibraryRootController(LibraryRootRepository roots, LibraryRootRegistrationService registration, LibraryRootCapabilityService capabilities, ContentStorageService content) {
        this.roots = roots; this.registration = registration; this.capabilities = capabilities; this.content = content;
    }

    @GetMapping("/content-storage")
    public List<ContentStorageService.Snapshot> contentStorage() { return content.snapshots(); }

    @GetMapping
    RootList list() {
        return new RootList(roots.findAll());
    }

    @org.springframework.web.bind.annotation.PostMapping("/preview")
    Object preview(@org.springframework.web.bind.annotation.RequestBody Location input) { return registration.preview(input.path()); }
    @org.springframework.web.bind.annotation.PostMapping
    LibraryRoot create(@org.springframework.web.bind.annotation.RequestBody Registration input) { return registration.create(input.name(), input.path(), input.expectedFingerprint(), input.idempotencyKey()); }
    @org.springframework.web.bind.annotation.PostMapping("/check")
    RootList check() {
        capabilities.checkAll();
        if (!content.scanAll()) throw new com.elexvx.bookkin.common.ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
            "CONTENT_SCAN_FAILED", "文章或禁书区目录扫描未完成，请检查目录可读性后重试。");
        return new RootList(roots.findAll());
    }
    @org.springframework.web.bind.annotation.ExceptionHandler(IllegalArgumentException.class)
    org.springframework.http.ResponseEntity<java.util.Map<String, String>> invalidLocation(IllegalArgumentException error) {
        return org.springframework.http.ResponseEntity.badRequest().body(java.util.Map.of("code", "INVALID_LIBRARY_LOCATION", "detail", error.getMessage()));
    }
    public record Location(String path) {}
    public record Registration(String name, String path, String expectedFingerprint, java.util.UUID idempotencyKey) {}
    public record RootList(List<LibraryRoot> items) {}
}
