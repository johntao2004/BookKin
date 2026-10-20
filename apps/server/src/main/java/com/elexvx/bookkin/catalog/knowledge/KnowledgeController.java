package com.elexvx.bookkin.catalog.knowledge;

import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/knowledge")
public class KnowledgeController {
    private final KnowledgeService service;
    public KnowledgeController(KnowledgeService service) { this.service = service; }
    @GetMapping
    public KnowledgeList list() { return new KnowledgeList(service.list()); }
    @PostMapping("/books/{bookId}/generate")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public KnowledgeList generate(@PathVariable UUID bookId) { service.generate(bookId); return list(); }
    public record KnowledgeList(List<KnowledgeRepository.KnowledgeBook> items) {}
}
