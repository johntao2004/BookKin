package com.elexvx.bookkin.ingestion.upload;

import static org.mockito.Mockito.*;
import java.security.Principal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class UploadVisibilityDefaultTest {
    @Test void defaultsMissingOptionsToPublicAndRespectsExplicitNo() {
        var service = mock(BookUploadService.class);
        var controller = new BookUploadController(service);
        UUID id = UUID.randomUUID(); Principal actor = () -> "owner";
        controller.commit(id, "key", null, actor);
        controller.commit(id, "key", new BookUploadController.CommitRequest(null), actor);
        controller.commit(id, "key", new BookUploadController.CommitRequest(true), actor);
        verify(service, times(3)).commit(id, "key", true, actor);
        controller.commit(id, "key", new BookUploadController.CommitRequest(false), actor);
        verify(service).commit(id, "key", false, actor);
    }
    @Test void replayDoesNotRePublicizeABookHiddenAfterItsOriginalUpload() {
        var uploads = mock(BookUploadRepository.class);
        var users = mock(com.elexvx.bookkin.users.UserRepository.class);
        var user = mock(com.elexvx.bookkin.users.BookKinUser.class);
        var entity = mock(BookUploadModels.UploadEntity.class);
        var display = mock(com.elexvx.bookkin.catalog.DisplayCatalogService.class);
        UUID id = UUID.randomUUID(); UUID actorId = UUID.randomUUID();
        when(user.id()).thenReturn(actorId);
        when(users.findByUsername("owner")).thenReturn(java.util.Optional.of(user));
        when(uploads.findOwned(id, actorId)).thenReturn(java.util.Optional.of(entity));
        when(entity.status()).thenReturn(BookUploadModels.BookUploadStatus.SUCCEEDED);
        when(entity.idempotencyKey()).thenReturn("key");
        when(entity.committedBookId()).thenReturn(UUID.randomUUID());
        var service = new BookUploadService(uploads, null, null, null, null, null, null, users, null, null, null, null, null, null, display);
        service.commit(id, "key", true, () -> "owner");
        verifyNoInteractions(display);
        verify(uploads, never()).beginCommit(any(), any(), any());
    }
}
