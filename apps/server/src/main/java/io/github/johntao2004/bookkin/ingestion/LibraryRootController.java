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

    public LibraryRootController(LibraryRootRepository roots) {
        this.roots = roots;
    }

    @GetMapping
    RootList list() {
        return new RootList(roots.findAll());
    }

    public record RootList(List<LibraryRoot> items) {}
}
