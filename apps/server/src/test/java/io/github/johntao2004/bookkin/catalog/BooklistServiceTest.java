package io.github.johntao2004.bookkin.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.users.BookKinUser;
import io.github.johntao2004.bookkin.users.UserRepository;
import io.github.johntao2004.bookkin.users.UserRole;
import io.github.johntao2004.bookkin.users.UserStatus;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class BooklistServiceTest {
    private BooklistRepository booklists;
    private BookRepository books;
    private UserRepository users;
    private BooklistService service;

    @BeforeEach
    void setUp() {
        booklists = mock(BooklistRepository.class);
        books = mock(BookRepository.class);
        users = mock(UserRepository.class);
        service = new BooklistService(booklists, books, users);
    }

    @Test
    void privateOfficialListIsHiddenAndReadOnlyForOtherManagers() {
        UUID creatorId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        UUID listId = UUID.randomUUID();
        login("viewer", viewerId, UserRole.ADMIN);
        when(booklists.findRaw(listId)).thenReturn(raw(listId, creatorId,
                BooklistKind.OFFICIAL, BooklistVisibility.PRIVATE, 0));

        ApiException hidden = assertThrows(ApiException.class, () -> service.get(listId, principal("viewer")));
        assertEquals(404, hidden.status().value());
        ApiException edit = assertThrows(ApiException.class, () -> service.update(listId,
                "私密官方书单", null, BooklistVisibility.MEMBERS, 0, principal("viewer")));
        assertEquals(403, edit.status().value());
    }

    @Test
    void memberCannotCreateOfficialList() {
        login("member", UUID.randomUUID(), UserRole.MEMBER);

        ApiException error = assertThrows(ApiException.class, () -> service.create(
                BooklistKind.OFFICIAL, BooklistVisibility.PUBLIC, "越权书单", null, principal("member")));

        assertEquals("OFFICIAL_BOOKLIST_FORBIDDEN", error.code());
    }

    @Test
    void publicPublishingNamesConflictingNonPublicBooks() {
        UUID creatorId = UUID.randomUUID();
        UUID listId = UUID.randomUUID();
        login("creator", creatorId, UserRole.MEMBER);
        when(booklists.findRaw(listId)).thenReturn(raw(listId, creatorId,
                BooklistKind.PERSONAL, BooklistVisibility.PRIVATE, 2));
        when(booklists.nonPublicBookTitles(listId)).thenReturn(List.of("家庭私藏"));

        ApiException error = assertThrows(ApiException.class, () -> service.update(listId,
                "阅读路径", null, BooklistVisibility.PUBLIC, 2, principal("creator")));

        assertEquals("BOOKLIST_PUBLIC_BOOKS_REQUIRED", error.code());
        assertEquals(true, error.getMessage().contains("家庭私藏"));
    }

    @Test
    void anonymousBookReadsAlwaysUsePublicFiltering() {
        UUID ownerId = UUID.randomUUID();
        UUID listId = UUID.randomUUID();
        when(booklists.findRaw(listId)).thenReturn(raw(listId, ownerId,
                BooklistKind.PERSONAL, BooklistVisibility.PUBLIC, 1));
        when(booklists.books(listId, null, null, null, 36, true))
                .thenReturn(new BrowseBookPage(List.of(), null));

        service.books(listId, null, null, null, 36, null);

        verify(booklists).books(eq(listId), isNull(), isNull(), isNull(), eq(36), eq(true));
    }

    private void login(String username, UUID id, UserRole role) {
        BookKinUser user = new BookKinUser(id, username, username, "hash", role, UserStatus.ACTIVE,
                false, OffsetDateTime.now(), null);
        when(users.findByUsername(username)).thenReturn(Optional.of(user));
    }

    private Principal principal(String username) {
        return () -> username;
    }

    private BooklistRepository.RawBooklist raw(UUID id, UUID ownerId, BooklistKind kind,
                                               BooklistVisibility visibility, long revision) {
        return new BooklistRepository.RawBooklist(id, ownerId, "创建者", kind, visibility,
                "阅读路径", null, revision, OffsetDateTime.now());
    }
}
