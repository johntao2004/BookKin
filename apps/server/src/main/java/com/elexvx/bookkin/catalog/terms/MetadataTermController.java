package com.elexvx.bookkin.catalog.terms;

import java.security.Principal;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("api")
@RequestMapping("/api/v1/metadata-terms")
public class MetadataTermController {
    private final MetadataTermService service;
    public MetadataTermController(MetadataTermService service) { this.service = service; }
    public record Items(List<MetadataTerm> items) {}
    public record Input(MetadataTermKind kind, String value, String label) {}
    public record Batch(MetadataTermKind kind, List<MetadataTermService.TermInput> items) {}
    @GetMapping
    Items search(@RequestParam MetadataTermKind kind, @RequestParam(defaultValue="") String q,
                 @RequestParam(defaultValue="30") int limit, Principal principal) {
        return new Items(service.search(kind, q, limit, principal));
    }
    @PostMapping
    MetadataTerm create(@RequestBody Input input, Principal principal) {
        return service.create(input.kind(), new MetadataTermService.TermInput(input.value(), input.label()), principal);
    }
    @PostMapping("/ensure")
    Items ensure(@RequestBody Batch input, Principal principal) {
        return new Items(service.ensure(input.kind(), input.items(), principal));
    }
}
