package io.github.johntao2004.bookkin.catalog;

import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.users.BookKinUser;
import io.github.johntao2004.bookkin.users.UserRepository;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BooklistService {
    private final BooklistRepository booklists;
    private final BookRepository books;
    private final UserRepository users;

    public BooklistService(BooklistRepository booklists, BookRepository books, UserRepository users) {
        this.booklists = booklists;
        this.books = books;
        this.users = users;
    }

    public BooklistRepository.BooklistList list(String query, Principal principal) {
        BookKinUser actor = optionalActor(principal);
        return booklists.listVisible(query, actor == null ? null : actor.id(), actor != null,
                actor != null && actor.canManageFiles());
    }

    public BooklistRepository.BooklistDetail get(UUID id, Principal principal) {
        BookKinUser actor = optionalActor(principal);
        BooklistRepository.RawBooklist raw = visible(id, actor);
        return booklists.detail(raw, actor == null ? null : actor.id(), actor != null && actor.canManageFiles(), actor == null);
    }

    public BrowseBookPage books(UUID id, String query, BookFormat format, String cursor, int limit, Principal principal) {
        BookKinUser actor = optionalActor(principal);
        visible(id, actor);
        return booklists.books(id, query, format, cursor, limit, actor == null);
    }

    @Transactional
    public BooklistRepository.BooklistDetail create(BooklistKind kind, BooklistVisibility visibility,
                                                    String title, String description, Principal principal) {
        BookKinUser actor = requiredActor(principal);
        if (kind == BooklistKind.OFFICIAL && !actor.canManageFiles()) {
            throw ApiException.forbidden("OFFICIAL_BOOKLIST_FORBIDDEN", "只有主人或管理员可以创建官方书单。");
        }
        BooklistRepository.RawBooklist raw = booklists.create(actor.id(), kind, visibility,
                cleanTitle(title), cleanDescription(description));
        return booklists.detail(raw, actor.id(), actor.canManageFiles(), false);
    }

    @Transactional
    public BooklistRepository.BooklistDetail update(UUID id, String title, String description,
                                                    BooklistVisibility visibility, long revision,
                                                    Principal principal) {
        BookKinUser actor = requiredActor(principal);
        BooklistRepository.RawBooklist current = editable(id, actor);
        if (visibility == BooklistVisibility.PUBLIC) ensurePublic(booklists.nonPublicBookTitles(id));
        BooklistRepository.RawBooklist updated = booklists.update(current.id(), cleanTitle(title),
                cleanDescription(description), visibility, revision);
        return booklists.detail(updated, actor.id(), actor.canManageFiles(), false);
    }

    @Transactional
    public void delete(UUID id, long revision, Principal principal) {
        BookKinUser actor = requiredActor(principal);
        editable(id, actor);
        booklists.delete(id, revision);
    }

    @Transactional
    public BooklistRepository.BooklistDetail addBooks(UUID id, List<UUID> bookIds, long revision, Principal principal) {
        BookKinUser actor = requiredActor(principal);
        BooklistRepository.RawBooklist current = editable(id, actor);
        List<UUID> distinct = bookIds.stream().distinct().toList();
        if (distinct.size() != bookIds.size()) {
            throw ApiException.conflict("DUPLICATE_BOOKLIST_BOOK", "同一本书不能重复加入书单。");
        }
        for (UUID bookId : distinct) {
            if (!books.exists(bookId)) throw ApiException.notFound("BOOK_NOT_FOUND", "部分书籍已不存在，请刷新后重试。");
        }
        if (current.visibility() == BooklistVisibility.PUBLIC) {
            ensurePublic(booklists.nonPublicBookTitles(distinct));
        }
        BooklistRepository.RawBooklist updated = booklists.addBooks(id, distinct, revision);
        return booklists.detail(updated, actor.id(), actor.canManageFiles(), false);
    }

    @Transactional
    public BooklistRepository.BooklistDetail removeBook(UUID id, UUID bookId, long revision, Principal principal) {
        BookKinUser actor = requiredActor(principal);
        editable(id, actor);
        BooklistRepository.RawBooklist updated = booklists.removeBook(id, bookId, revision);
        return booklists.detail(updated, actor.id(), actor.canManageFiles(), false);
    }

    @Transactional
    public BooklistRepository.BooklistDetail reorder(UUID id, List<UUID> bookIds, long revision, Principal principal) {
        BookKinUser actor = requiredActor(principal);
        editable(id, actor);
        BooklistRepository.RawBooklist updated = booklists.reorder(id, bookIds, revision);
        return booklists.detail(updated, actor.id(), actor.canManageFiles(), false);
    }

    private BooklistRepository.RawBooklist visible(UUID id, BookKinUser actor) {
        BooklistRepository.RawBooklist raw = booklists.findRaw(id);
        boolean visible = actor == null
                ? raw.visibility() == BooklistVisibility.PUBLIC
                : raw.ownerId().equals(actor.id())
                    || raw.visibility() == BooklistVisibility.MEMBERS
                    || raw.visibility() == BooklistVisibility.PUBLIC;
        if (!visible) throw ApiException.notFound("BOOKLIST_NOT_FOUND", "未找到这个书单。");
        return raw;
    }

    private BooklistRepository.RawBooklist editable(UUID id, BookKinUser actor) {
        BooklistRepository.RawBooklist raw = booklists.findRaw(id);
        boolean editable = raw.visibility() == BooklistVisibility.PRIVATE && !raw.ownerId().equals(actor.id())
                ? false
                : raw.kind() == BooklistKind.OFFICIAL
                    ? actor.canManageFiles()
                    : raw.ownerId().equals(actor.id());
        if (!editable) throw ApiException.forbidden("BOOKLIST_EDIT_FORBIDDEN", "只有书单创建者可以修改这个书单。");
        return raw;
    }

    private BookKinUser requiredActor(Principal principal) {
        BookKinUser actor = optionalActor(principal);
        if (actor == null) throw ApiException.forbidden("AUTH_REQUIRED", "请先登录。");
        return actor;
    }

    private BookKinUser optionalActor(Principal principal) {
        if (principal == null) return null;
        return users.findByUsername(principal.getName()).orElse(null);
    }

    private void ensurePublic(List<String> nonPublicTitles) {
        if (nonPublicTitles.isEmpty()) return;
        String sample = String.join("、", nonPublicTitles.stream().limit(5).toList());
        String suffix = nonPublicTitles.size() > 5 ? "等 " + nonPublicTitles.size() + " 本" : "";
        throw ApiException.conflict("BOOKLIST_PUBLIC_BOOKS_REQUIRED",
                "公开书单只能包含公共书目，请先处理：" + sample + suffix + "。");
    }

    private String cleanTitle(String value) {
        String title = value == null ? "" : value.strip();
        if (title.isEmpty()) throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST,
                "BOOKLIST_TITLE_REQUIRED", "请输入书单名称。");
        return title;
    }

    private String cleanDescription(String value) {
        if (value == null || value.isBlank()) return null;
        return value.strip();
    }
}
