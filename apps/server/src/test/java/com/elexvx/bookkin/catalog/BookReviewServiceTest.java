package com.elexvx.bookkin.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import com.elexvx.bookkin.users.UserRole;
import com.elexvx.bookkin.users.UserStatus;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class BookReviewServiceTest {
    private BookReviewRepository reviews;
    private BookRepository books;
    private UserRepository users;
    private BookReviewService service;
    private final UUID userId = UUID.randomUUID();
    private final UUID bookId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        reviews = mock(BookReviewRepository.class);
        books = mock(BookRepository.class);
        users = mock(UserRepository.class);
        service = new BookReviewService(reviews, books, users);
        when(users.findByUsername("reader")).thenReturn(Optional.of(user(userId, UserRole.MEMBER)));
        when(books.exists(bookId)).thenReturn(true);
    }

    @Test
    void creationDefaultsToPrivateAndReadsOnlyTheCurrentUsersPrivateRows() {
        var stored = review(UUID.randomUUID(), userId, ReviewVisibility.PRIVATE, 1);
        when(reviews.create(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq(bookId),
                org.mockito.ArgumentMatchers.eq(userId), org.mockito.ArgumentMatchers.eq("reader"),
                org.mockito.ArgumentMatchers.eq("读后感"), org.mockito.ArgumentMatchers.eq("## 记录"),
                org.mockito.ArgumentMatchers.eq(ReviewVisibility.PRIVATE))).thenReturn(stored);
        when(reviews.findVisible(bookId, userId)).thenReturn(java.util.List.of(stored));

        var created = service.create(bookId, "读后感", "## 记录", null, () -> "reader");
        var visible = service.list(bookId, () -> "reader");

        assertEquals(stored, created);
        assertEquals(java.util.List.of(stored), visible);
        verify(reviews).findVisible(bookId, userId);
    }

    @Test
    void anotherUserAndManagersCannotUpdateAnOwnersPrivateReview() {
        UUID privateId = UUID.randomUUID();
        when(reviews.update(privateId, userId, 1, "篡改", "正文", ReviewVisibility.LIBRARY)).thenReturn(Optional.empty());
        when(reviews.ownedBy(privateId, userId)).thenReturn(false);

        ApiException hidden = assertThrows(ApiException.class,
                () -> service.update(privateId, "篡改", "正文", ReviewVisibility.LIBRARY, 1, () -> "reader"));

        assertEquals(404, hidden.status().value());
        assertEquals("BOOK_REVIEW_NOT_FOUND", hidden.code());
    }

    @Test
    void staleRevisionConflictsAndMissingBooksAreHidden() {
        UUID reviewId = UUID.randomUUID();
        when(reviews.update(reviewId, userId, 1, "新标题", "新正文", ReviewVisibility.PRIVATE)).thenReturn(Optional.empty());
        when(reviews.ownedBy(reviewId, userId)).thenReturn(true);
        ApiException conflict = assertThrows(ApiException.class,
                () -> service.update(reviewId, "新标题", "新正文", ReviewVisibility.PRIVATE, 1, () -> "reader"));
        assertEquals(409, conflict.status().value());

        when(books.exists(bookId)).thenReturn(false);
        ApiException missingBook = assertThrows(ApiException.class, () -> service.list(bookId, () -> "reader"));
        assertEquals(404, missingBook.status().value());
    }

    private static BookKinUser user(UUID id, UserRole role) {
        return new BookKinUser(id, "reader", "reader", "hash", role, UserStatus.ACTIVE,
                false, OffsetDateTime.now(), null);
    }

    private BookReviewRepository.BookReview review(UUID id, UUID ownerId, ReviewVisibility visibility, long revision) {
        var now = OffsetDateTime.now();
        return new BookReviewRepository.BookReview(id, bookId, ownerId, "reader", "读后感", "## 记录",
                visibility, revision, now, now);
    }
}
