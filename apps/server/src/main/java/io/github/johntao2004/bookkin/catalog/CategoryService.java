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
public class CategoryService {
    private final CategoryRepository categories;
    private final BookRepository books;
    private final UserRepository users;

    public CategoryService(CategoryRepository categories, BookRepository books, UserRepository users) {
        this.categories = categories;
        this.books = books;
        this.users = users;
    }

    public CategoryRepository.CategoryList list(String query, Principal principal) {
        BookKinUser actor = optionalActor(principal);
        return categories.list(query, actor == null, actor != null && actor.canManageFiles());
    }

    public CategoryRepository.CategoryDetail get(UUID id, Principal principal) {
        BookKinUser actor = optionalActor(principal);
        return categories.find(id, actor == null, actor != null && actor.canManageFiles());
    }

    public BrowseBookPage books(UUID id, String query, BookFormat format, BookSort sort, String cursor,
                                int limit, Principal principal) {
        BookKinUser actor = optionalActor(principal);
        categories.find(id, actor == null, actor != null && actor.canManageFiles());
        return categories.books(id, query, format, sort, cursor, limit, actor == null);
    }

    @Transactional
    public CategoryRepository.CategoryDetail create(String name, String description, Principal principal) {
        BookKinUser actor = manager(principal);
        return categories.create(cleanName(name), cleanDescription(description), actor.id());
    }

    @Transactional
    public CategoryRepository.CategoryDetail update(UUID id, String name, String description, Principal principal) {
        manager(principal);
        return categories.update(id, cleanName(name), cleanDescription(description));
    }

    @Transactional
    public void delete(UUID id, Principal principal) {
        manager(principal);
        categories.delete(id);
    }

    @Transactional
    public CategoryRepository.CategoryList reorder(List<UUID> ids, Principal principal) {
        manager(principal);
        return categories.reorder(ids);
    }

    public CategoryRepository.CategoryList categoriesForBook(UUID bookId, Principal principal) {
        BookKinUser actor = requiredActor(principal);
        if (!books.exists(bookId)) throw ApiException.notFound("BOOK_NOT_FOUND", "未找到这本书。");
        return categories.assignedToBook(bookId, actor.canManageFiles());
    }

    @Transactional
    public CategoryRepository.CategoryList replaceBookCategories(UUID bookId, List<UUID> categoryIds, Principal principal) {
        BookKinUser actor = manager(principal);
        if (!books.exists(bookId)) throw ApiException.notFound("BOOK_NOT_FOUND", "未找到这本书。");
        return categories.replaceBookCategories(bookId, categoryIds, actor.id());
    }

    private BookKinUser manager(Principal principal) {
        BookKinUser actor = requiredActor(principal);
        if (!actor.canManageFiles()) throw ApiException.forbidden("CATEGORY_MANAGEMENT_FORBIDDEN", "只有主人或管理员可以维护分类。");
        return actor;
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

    private String cleanName(String value) {
        String name = value == null ? "" : value.strip();
        if (name.isEmpty()) throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST,
                "CATEGORY_NAME_REQUIRED", "请输入分类名称。");
        return name;
    }

    private String cleanDescription(String value) {
        if (value == null || value.isBlank()) return null;
        return value.strip();
    }
}
