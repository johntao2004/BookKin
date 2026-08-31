package io.github.johntao2004.bookkin.catalog;

import io.github.johntao2004.bookkin.audit.AuditService;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.users.BookKinUser;
import io.github.johntao2004.bookkin.users.UserRepository;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DisplayCatalogService {
    private final DisplayCatalogRepository display;
    private final BookRepository books;
    private final UserRepository users;
    private final AuditService audit;

    public DisplayCatalogService(DisplayCatalogRepository display, BookRepository books, UserRepository users, AuditService audit) {
        this.display = display;
        this.books = books;
        this.users = users;
        this.audit = audit;
    }

    public DisplayCatalogRepository.DisplayBookPage list(String query, String cursor, int limit) {
        return display.list(query, cursor, limit);
    }

    public DisplayCatalogRepository.DisplayBook findPublic(UUID bookId) {
        return display.find(bookId);
    }

    public boolean isPublic(UUID bookId) {
        return display.contains(bookId);
    }

    @Transactional
    public DisplayCatalogRepository.DisplayBook add(UUID bookId, long revision, Principal principal) {
        BookKinUser actor = actor(principal);
        if (!books.exists(bookId)) throw ApiException.notFound("BOOK_NOT_FOUND", "只能把书库中已有的书籍加入公共书目。");
        var result = display.add(bookId, actor.id(), revision);
        audit.record(actor.id(), "DISPLAY_BOOK_ADDED", "BOOK", bookId.toString(), null, null, null, null, "SUCCEEDED", "{}");
        return result;
    }

    @Transactional
    public boolean remove(UUID bookId, long revision, Principal principal) {
        BookKinUser actor = actor(principal);
        boolean removed = display.remove(bookId, revision);
        if (removed) audit.record(actor.id(), "DISPLAY_BOOK_REMOVED", "BOOK", bookId.toString(), null, null, null, null, "SUCCEEDED", "{}");
        return removed;
    }

    @Transactional
    public DisplayCatalogRepository.DisplayBookPage reorder(List<UUID> bookIds, long revision, Principal principal) {
        BookKinUser actor = actor(principal);
        var result = display.reorder(bookIds, revision);
        audit.record(actor.id(), "DISPLAY_BOOKS_REORDERED", "DISPLAY_CATALOG", "1", null, null, null, null, "SUCCEEDED", "{}");
        return result;
    }

    @Transactional
    public DisplayCatalogRepository.DisplayBook publish(UUID bookId, UUID actorId) {
        books.findPreferredFile(bookId).orElseThrow(() -> ApiException.notFound("BOOK_NOT_FOUND", "只能公开已有可用书籍。"));
        return display.publish(bookId, actorId);
    }

    private BookKinUser actor(Principal principal) {
        if (principal == null) throw ApiException.forbidden("AUTH_REQUIRED", "请先登录。");
        return users.findByUsername(principal.getName()).orElseThrow();
    }
}
