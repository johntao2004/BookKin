package io.github.johntao2004.bookkin.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
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

class CategoryServiceTest {
    private CategoryRepository categories;
    private BookRepository books;
    private UserRepository users;
    private CategoryService service;

    @BeforeEach
    void setUp() {
        categories = mock(CategoryRepository.class);
        books = mock(BookRepository.class);
        users = mock(UserRepository.class);
        service = new CategoryService(categories, books, users);
    }

    @Test
    void anonymousAndManagerListingsUseDifferentVisibilityContexts() {
        when(categories.list(null, true, false)).thenReturn(new CategoryRepository.CategoryList(List.of(), false));
        service.list(null, null);
        verify(categories).list(null, true, false);

        login("admin", UUID.randomUUID(), UserRole.ADMIN);
        when(categories.list(null, false, true)).thenReturn(new CategoryRepository.CategoryList(List.of(), true));
        service.list(null, principal("admin"));
        verify(categories).list(null, false, true);
    }

    @Test
    void memberCannotMaintainCategories() {
        login("member", UUID.randomUUID(), UserRole.MEMBER);

        ApiException error = assertThrows(ApiException.class,
                () -> service.create("文学", null, principal("member")));

        assertEquals("CATEGORY_MANAGEMENT_FORBIDDEN", error.code());
    }

    @Test
    void managerCanReplaceAbooksMultipleIndependentCategories() {
        UUID managerId = UUID.randomUUID();
        UUID bookId = UUID.randomUUID();
        List<UUID> categoryIds = List.of(UUID.randomUUID(), UUID.randomUUID());
        var result = new CategoryRepository.CategoryList(List.of(), true);
        login("admin", managerId, UserRole.ADMIN);
        when(books.exists(bookId)).thenReturn(true);
        when(categories.replaceBookCategories(bookId, categoryIds, managerId)).thenReturn(result);

        assertEquals(result, service.replaceBookCategories(bookId, categoryIds, principal("admin")));
        verify(categories).replaceBookCategories(bookId, categoryIds, managerId);
    }

    private void login(String username, UUID id, UserRole role) {
        BookKinUser user = new BookKinUser(id, username, username, "hash", role, UserStatus.ACTIVE,
                false, OffsetDateTime.now(), null);
        when(users.findByUsername(username)).thenReturn(Optional.of(user));
    }

    private Principal principal(String username) {
        return () -> username;
    }
}
