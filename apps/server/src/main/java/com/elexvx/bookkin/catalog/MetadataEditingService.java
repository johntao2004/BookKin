package com.elexvx.bookkin.catalog;

import java.security.Principal;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MetadataEditingService {
    private final BookMetadataRepository metadata;
    private final DisplayCatalogService display;
    public MetadataEditingService(BookMetadataRepository metadata, DisplayCatalogService display) {
        this.metadata = metadata; this.display = display;
    }
    /** Bibliographic edits and public visibility are saved as one database transaction. */
    @Transactional
    public void update(UUID bookId, BookMetadataRepository.MetadataPatch patch, Boolean publiclyVisible, Principal principal) {
        metadata.update(bookId, patch);
        if (publiclyVisible != null) display.setVisibility(bookId, publiclyVisible, principal);
    }
}
