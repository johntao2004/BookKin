package com.elexvx.bookkin.catalog;

import com.elexvx.bookkin.filemanagement.infrastructure.BookBibliographyReader;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/display-books/{id}")
public class PublicBookMetadataController {
    private final PublicBookMetadataService metadata;
    public PublicBookMetadataController(PublicBookMetadataService metadata) { this.metadata = metadata; }

    @GetMapping("/metadata")
    PublicBookMetadataService.PublicMetadata get(@PathVariable UUID id) { return metadata.metadata(id); }

    @GetMapping("/bibliography-source")
    BookBibliographyReader.Source source(@PathVariable UUID id) throws Exception { return metadata.bibliography(id); }
}
