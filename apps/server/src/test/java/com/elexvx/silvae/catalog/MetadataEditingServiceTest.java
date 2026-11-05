// 验证元数据与公开状态一起变更，并确保无效元数据不会先改变公开范围。
// Checks coordinated metadata/visibility changes and prevents invalid metadata from changing visibility first.
package com.elexvx.silvae.catalog;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;
import java.security.Principal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MetadataEditingServiceTest {
    final BookMetadataRepository metadata = mock(BookMetadataRepository.class);
    final DisplayCatalogService display = mock(DisplayCatalogService.class);
    final com.elexvx.silvae.filemanagement.BookTitleFileService filenames = mock(com.elexvx.silvae.filemanagement.BookTitleFileService.class);
    final MetadataEditingService service = new MetadataEditingService(metadata, display, filenames);
    final UUID id = UUID.randomUUID();
    final Principal actor = () -> "owner";
    @org.junit.jupiter.api.BeforeEach void savedMetadata() {
        var saved = mock(BookMetadataRepository.BookMetadata.class);
        when(saved.title()).thenReturn("书名");
        when(metadata.find(id)).thenReturn(java.util.Optional.of(saved));
    }
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
