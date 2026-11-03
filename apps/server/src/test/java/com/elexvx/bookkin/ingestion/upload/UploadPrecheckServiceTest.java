package com.elexvx.bookkin.ingestion.upload;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.elexvx.bookkin.auth.RolePermissionService;
import com.elexvx.bookkin.catalog.BookRepository;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.config.BookKinProperties;
import com.elexvx.bookkin.users.*;
import java.security.Principal;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class UploadPrecheckServiceTest {
    private static final String HASH = "sha256:" + "a".repeat(64);
    private final Principal principal = () -> "manager";
    private final UUID actorId = UUID.randomUUID();
    private final BookUploadRepository uploads = mock(BookUploadRepository.class);
    private final BookRepository books = mock(BookRepository.class);
    private final RolePermissionService permissions = mock(RolePermissionService.class);
    private final UploadPrecheckService service = new UploadPrecheckService(uploads, books, permissions,
            new BookKinProperties(null,null,null,null,null,null,null,null,null,null,null));
    private void actor(Set<String> grants) {
        when(permissions.actor(principal)).thenReturn(new BookKinUser(actorId,"manager","Manager","hash",UserRole.ADMIN,UserStatus.ACTIVE,false,null,null));
        when(permissions.snapshot(principal)).thenReturn(new RolePermissionService.Snapshot(UserRole.ADMIN,1,grants));
    }
    @Test void visibleCatalogDuplicateReturnsOnlyMatchAndDoesNotCreateSession() {
        actor(Set.of("library.view")); when(books.hasAvailableFingerprint(HASH, 4)).thenReturn(true);
        assertThat(service.check(HASH,4,principal)).isEqualTo(UploadPrecheckService.Match.CATALOG);
        verify(permissions).require(principal,"library.upload"); verifyNoInteractions(uploads);
    }
    @Test void withoutCatalogPermissionOnlyTheCurrentManagersDraftsAreProbed() {
        actor(Set.of()); when(uploads.hasOwnedPendingFingerprint(actorId,HASH,4)).thenReturn(true);
        assertThat(service.check(HASH,4,principal)).isEqualTo(UploadPrecheckService.Match.DRAFT);
        verifyNoInteractions(books);
        verify(uploads).hasOwnedPendingFingerprint(actorId,HASH,4); verifyNoMoreInteractions(uploads);
    }
    @Test void unknownContentReturnsNoneWithoutAWrite() {
        actor(Set.of("library.view"));
        assertThat(service.check(HASH,4,principal)).isEqualTo(UploadPrecheckService.Match.NONE);
        verify(uploads).hasOwnedPendingFingerprint(actorId,HASH,4); verifyNoMoreInteractions(uploads);
    }
    @Test void rejectsInvalidFingerprintsAndOversizeBeforeAnyContentQuery() {
        actor(Set.of("library.view"));
        assertThatThrownBy(() -> service.check("sha256:fake",4,principal)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.check(HASH,0,principal)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.check(HASH,2L*1024*1024*1024+1,principal)).isInstanceOf(ApiException.class);
        verifyNoInteractions(books,uploads);
    }
    @Test void rejectsAUserWhoCannotManageFilesEvenIfTheCallerBypassesTheController() {
        actor(Set.of("library.view"));
        when(permissions.actor(principal)).thenReturn(new BookKinUser(actorId,"member","Member","hash",UserRole.MEMBER,UserStatus.ACTIVE,false,null,null));
        assertThatThrownBy(() -> service.check(HASH,4,principal)).isInstanceOf(ApiException.class);
        verifyNoInteractions(books,uploads);
    }
}
