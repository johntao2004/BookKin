package com.elexvx.bookkin.catalog;

import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.UserRepository;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookReviewService {
    private final BookReviewRepository reviews;
    private final BookRepository books;
    private final UserRepository users;

    public BookReviewService(BookReviewRepository reviews, BookRepository books, UserRepository users) {
        this.reviews = reviews;
        this.books = books;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<BookReviewRepository.BookReview> list(UUID bookId, Principal principal) {
        var user = actor(principal);
        requireBook(bookId);
        return reviews.findVisible(bookId, user.id());
    }

    @Transactional(readOnly = true)
    public List<BookReviewRepository.BookReview> mine(Principal principal, OffsetDateTime before, UUID beforeId, int limit) {
        return reviews.findMine(actor(principal).id(), before, beforeId, Math.max(1, Math.min(51, limit)));
    }

    @Transactional(readOnly = true)
    public BookReviewRepository.BookReview get(UUID id, Principal principal) {
        var review = reviews.findVisibleById(id, actor(principal).id()).orElseThrow(this::notFound);
        requireBook(review.bookId());
        return review;
    }

    @Transactional
    public BookReviewRepository.BookReview create(UUID bookId, String title, String markdown,
                                                  ReviewVisibility visibility, Principal principal) {
        var user = actor(principal);
        requireBook(bookId);
        validate(title, markdown);
        return reviews.create(UUID.randomUUID(), bookId, user.id(), user.displayName(), title, markdown,
                visibility == null ? ReviewVisibility.PRIVATE : visibility);
    }

    @Transactional
    public BookReviewRepository.BookReview update(UUID id, String title, String markdown,
                                                  ReviewVisibility visibility, long revision, Principal principal) {
        var user = actor(principal);
        validate(title, markdown);
        ReviewVisibility selectedVisibility = visibility == null ? ReviewVisibility.PRIVATE : visibility;
        var updated = reviews.update(id, user.id(), revision, title, markdown, selectedVisibility);
        if (updated.isPresent()) return updated.get();
        if (!reviews.ownedBy(id, user.id())) throw notFound();
        throw ApiException.conflict("REVISION_CONFLICT", "读后长文已在其他页面更新，请刷新后重试。");
    }

    private void requireBook(UUID bookId) {
        if (bookId == null || !books.exists(bookId)) throw ApiException.notFound("BOOK_NOT_FOUND", "未找到这本书。");
    }

    private com.elexvx.bookkin.users.BookKinUser actor(Principal principal) {
        if (principal == null) throw ApiException.forbidden("AUTH_REQUIRED", "请先登录。");
        return users.findByUsername(principal.getName())
                .orElseThrow(() -> ApiException.forbidden("AUTH_REQUIRED", "请先登录。"));
    }

    private void validate(String title, String markdown) {
        if (title == null || title.isBlank() || title.length() > 200)
            throw ApiException.badRequest("REVIEW_TITLE_INVALID", "标题不能为空且不能超过 200 个字符。");
        if (markdown == null || markdown.isBlank() || markdown.length() > 500_000)
            throw ApiException.badRequest("REVIEW_MARKDOWN_INVALID", "Markdown 正文不能为空且不能超过 500000 个字符。");
    }

    private ApiException notFound() {
        return ApiException.notFound("BOOK_REVIEW_NOT_FOUND", "读后长文不存在或无权访问。");
    }
}
