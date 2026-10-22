package com.elexvx.bookkin.catalog;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 公共目录可见性独立于私人阅读数据；取消公开不删除原书或个人记录。
// Public catalog visibility is separate from private reading data; unpublishing does not delete the book or personal records.
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

    public DisplayCatalogRepository.DisplayBookPage list(String query, UUID categoryId, BookFormat format,
                                                          BookSort sort, String cursor, int limit) {
        return display.list(query, categoryId, format, sort, cursor, limit);
    }
    public DisplayCatalogRepository.DisplayBookPage list(String query, UUID categoryId, BookFormat format,
                                                        BookSort sort, String cursor, int limit, String subjectCode) {
        return display.list(query, categoryId, format, sort, cursor, limit, subjectCode);
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

    @Transactional
    public void setVisibility(UUID bookId, boolean visible, Principal principal) {
        BookKinUser actor = actor(principal);
        if (!books.exists(bookId)) throw ApiException.notFound("BOOK_NOT_FOUND", "未找到这本书。");
        if (visible) publish(bookId, actor.id());
        else display.unpublish(bookId);
    }

    private BookKinUser actor(Principal principal) {
        if (principal == null) throw ApiException.forbidden("AUTH_REQUIRED", "请先登录。");
        return users.findByUsername(principal.getName()).orElseThrow();
    }
}
