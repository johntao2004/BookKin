package com.elexvx.bookkin.catalog;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;
import java.security.Principal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MetadataEditingServiceTest {
    final BookMetadataRepository metadata = mock(BookMetadataRepository.class);
    final DisplayCatalogService display = mock(DisplayCatalogService.class);
    final MetadataEditingService service = new MetadataEditingService(metadata, display);
    final UUID id = UUID.randomUUID();
    final Principal actor = () -> "owner";
    @Test void appliesExplicitPublicAndPrivateChoicesWithoutChangingVisibilityForOlderClients() {
        service.update(id, null, false, actor);
        verify(display).setVisibility(id, false, actor);
        service.update(id, null, true, actor);
        verify(display).setVisibility(id, true, actor);
        clearInvocations(display);
        service.update(id, null, null, actor);
        verifyNoInteractions(display);
    }
    @Test void invalidMetadataCannotChangePublicVisibility() {
        doThrow(new IllegalArgumentException("invalid")).when(metadata).update(id, null);
        assertThrows(IllegalArgumentException.class, () -> service.update(id, null, true, actor));
        verifyNoInteractions(display);
    }
}
