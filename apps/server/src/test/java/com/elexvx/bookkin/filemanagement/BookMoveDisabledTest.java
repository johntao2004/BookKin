package com.elexvx.bookkin.filemanagement;

import com.elexvx.bookkin.auth.RolePermissionService;
import com.elexvx.bookkin.catalog.BookRepository;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.ingestion.LibraryRootRepository;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import com.elexvx.bookkin.users.UserRole;
import com.elexvx.bookkin.users.UserStatus;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class BookMoveDisabledTest {
    private final BookRepository books = mock(BookRepository.class);
    private final LibraryRootRepository roots = mock(LibraryRootRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final FileOperationRepository operations = mock(FileOperationRepository.class);
    private final PathPolicy paths = mock(PathPolicy.class);
    private final FileFingerprints fingerprints = mock(FileFingerprints.class);
    private final RolePermissionService permissions = mock(RolePermissionService.class);
    private final FileOperationService service = new FileOperationService(books, roots, users, operations,
        paths, fingerprints, mock(FileLeaseRepository.class), mock(RecycleBinRepository.class), permissions);
    private final UUID actorId = UUID.randomUUID();
    private final Principal actor = () -> "owner";

    BookMoveDisabledTest() {
        when(users.findByUsername("owner")).thenReturn(Optional.of(new BookKinUser(actorId, "owner", "主人", "hash",
            UserRole.OWNER, UserStatus.ACTIVE, false, OffsetDateTime.now(), null)));
    }

    @Test void rejectsNewMovesBeforeResolvingAnyBookOrFilesystemPath() {
        assertDisabled(() -> service.preview(new FileOperationModels.PreviewRequest(UUID.randomUUID(),
            FileOperationType.MOVE, UUID.randomUUID(), "target.epub", "fp", null, null), actor));
        verifyNoInteractions(books, roots, paths, fingerprints, operations);
    }

    @Test void refusesExecutionOfAnOldMovePreviewWithoutQueuingOrTouchingFiles() {
        var token = UUID.randomUUID();
        when(operations.findPreview(token)).thenReturn(Optional.of(new FileOperationRepository.PreviewRecord(token,
            actorId, FileOperationType.MOVE, UUID.randomUUID(), null, null, UUID.randomUUID(), UUID.randomUUID(),
            "old.epub", "target.epub", "fp", 0, "[]", "[]", OffsetDateTime.now().plusMinutes(5))));
        assertDisabled(() -> service.execute(new FileOperationModels.ExecuteRequest(token, "fp"), "legacy-move", actor));
        verify(operations, never()).create(any(), any(), any());
        verifyNoInteractions(books, roots, paths, fingerprints);
    }

    @Test void oldIdempotencyKeysCannotReenableMoves() {
        var token = UUID.randomUUID();
        when(operations.findIdempotency(actorId, "old-move")).thenReturn(Optional.of(
            new FileOperationRepository.IdempotencyRecord(null, token, "fp", FileOperationType.MOVE, null, null)));
        assertDisabled(() -> service.execute(new FileOperationModels.ExecuteRequest(token, "fp"), "old-move", actor));
        verify(operations, never()).findPreview(any());
        verify(operations, never()).create(any(), any(), any());
        verifyNoInteractions(books, roots, paths, fingerprints);
    }

    private void assertDisabled(org.junit.jupiter.api.function.Executable action) {
        var error = assertThrows(ApiException.class, action);
        assertThat(error.status().value()).isEqualTo(403);
        assertThat(error.code()).isEqualTo("BOOK_MOVE_DISABLED");
    }
}
