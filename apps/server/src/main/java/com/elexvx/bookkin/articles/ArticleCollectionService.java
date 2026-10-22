package com.elexvx.bookkin.articles;

import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import java.security.Principal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Application rules for member-owned and shared article collections. */
@Service
public class ArticleCollectionService {
    public static final int MAX_ARTICLES = 1000;
    private static final int MAX_PREVIEW_ARTICLES = 4;
    private static final Set<String> VISIBILITIES = Set.of("PRIVATE", "MEMBERS");

    private final ArticleCollectionRepository collections;
    private final UserRepository users;

    public ArticleCollectionService(ArticleCollectionRepository collections, UserRepository users) {
        this.collections = collections;
        this.users = users;
    }

    public record Summary(UUID id, String title, String description, String visibility,
                         String ownerDisplayName, boolean ownedByViewer, boolean editable,
                         int articleCount, List<Map<String, Object>> previewArticles, long revision,
                         java.time.OffsetDateTime createdAt, java.time.OffsetDateTime updatedAt) {}
    public record Detail(UUID id, String title, String description, String visibility,
                         String ownerDisplayName, boolean ownedByViewer, boolean editable,
                         int articleCount, List<Map<String, Object>> previewArticles, long revision,
                         java.time.OffsetDateTime createdAt, java.time.OffsetDateTime updatedAt,
                         List<Map<String, Object>> articles) {}
    public record ListResponse(List<Summary> items) {}

    @Transactional(readOnly = true)
    public ListResponse list(String q, Principal principal) {
        var viewer = actor(principal);
        String query = q == null || q.isBlank() ? null : q.trim();
        if (query != null && query.length() > 200)
            throw ApiException.badRequest("COLLECTION_QUERY_TOO_LONG", "合集搜索词不能超过 200 个字符。");
        var items = new ArrayList<Summary>();
        for (var row : collections.findReadableCollections(viewer, query)) {
            var articles = visibleArticles(row, viewer);
            items.add(summary(row, viewer, articles));
        }
        return new ListResponse(List.copyOf(items));
    }

    @Transactional
    public Detail create(String title, String description, String visibility, Principal principal) {
        var viewer = actor(principal);
        var cleanTitle = validTitle(title);
        var cleanDescription = validDescription(description);
        var cleanVisibility = validVisibility(visibility);
        UUID id = collections.insertCollection(viewer.id(), cleanTitle, cleanDescription, cleanVisibility);
        return get(id.toString(), principal);
    }

    @Transactional(readOnly = true)
    public Detail get(String id, Principal principal) {
        var viewer = actor(principal);
        var row = readable(id, viewer);
        return detail(row, viewer);
    }

    @Transactional
    public Detail update(String id, String title, String description, String visibility, long revision, Principal principal) {
        var viewer = actor(principal);
        var row = editable(id, viewer);
        checkRevision(row, revision);
        String cleanTitle = validTitle(title);
        String cleanDescription = validDescription(description);
        String cleanVisibility = validVisibility(visibility);
        if ("PRIVATE".equals(row.visibility()) && "MEMBERS".equals(cleanVisibility)) {
            var related = collections.findRelatedIds(row.id());
            if (related.size() > MAX_ARTICLES) throw tooManyArticles();
            var sources = collections.findSources(related, viewer, false, true);
            if (sources.size() != related.size()) throw ApiException.notFound("ARTICLE_NOT_FOUND", "部分文章不存在或无法访问。");
            if (sources.stream().anyMatch(source -> !"PUBLIC".equals(source.visibility())))
                throw ApiException.conflict("COLLECTION_PRIVATE_ARTICLES", "合集含有私有文章，无法设为成员共享。");
        }
        if (!collections.updateCollection(row.id(), viewer.id(), revision, cleanTitle, cleanDescription, cleanVisibility))
            throw revisionConflict();
        return detailById(row.id(), viewer);
    }

    @Transactional
    public void delete(String id, long revision, Principal principal) {
        var viewer = actor(principal);
        var row = editable(id, viewer);
        checkRevision(row, revision);
        if (!collections.deleteCollection(row.id(), viewer.id(), revision)) throw revisionConflict();
        // The FK cascade removes only collection membership rows; article and reading data are independent.
    }

    @Transactional
    public Detail addArticles(String id, List<UUID> articleIds, long revision, Principal principal) {
        var viewer = actor(principal);
        var row = editable(id, viewer);
        checkRevision(row, revision);
        if (articleIds == null) throw ApiException.badRequest("ARTICLE_IDS_REQUIRED", "请提供文章 ID 列表。");
        if (articleIds.size() > MAX_ARTICLES) throw tooManyArticles();

        var requested = new LinkedHashSet<>(articleIds);
        if (requested.contains(null)) throw ApiException.badRequest("ARTICLE_ID_INVALID", "文章 ID 无效。");
        var related = collections.findRelatedIds(row.id());
        if (related.size() > MAX_ARTICLES) throw tooManyArticles();
        if (requested.size() != articleIds.size())
            throw ApiException.conflict("DUPLICATE_ARTICLE_ID", "请求中包含重复文章，请刷新合集后重试。");
        for (UUID articleId : requested) {
            if (related.contains(articleId))
                throw ApiException.conflict("ARTICLE_ALREADY_IN_COLLECTION", "文章已在合集中，请刷新后重试。");
        }
        var additions = List.copyOf(requested);
        if (related.size() + additions.size() > MAX_ARTICLES) throw tooManyArticles();
        boolean shared = "MEMBERS".equals(row.visibility());
        var sources = collections.findSources(additions, viewer, false, true);
        if (sources.size() != additions.size()) {
            throw ApiException.notFound("ARTICLE_NOT_FOUND", "部分文章不存在或无法访问。");
        }
        if (shared && sources.stream().anyMatch(source -> !"PUBLIC".equals(source.visibility()))) {
            throw ApiException.conflict("COLLECTION_ARTICLE_NOT_PUBLIC", "成员共享合集只能包含公开文章。");
        }

        if (!collections.bumpRevision(row.id(), viewer.id(), revision)) throw revisionConflict();
        collections.rewriteOrder(row.id(), related);
        int position = related.size();
        for (UUID articleId : additions) collections.insertRelation(row.id(), articleId, position++);
        return detailById(row.id(), viewer);
    }

    @Transactional
    public Detail removeArticle(String id, String articleId, long revision, Principal principal) {
        var viewer = actor(principal);
        var row = editable(id, viewer);
        checkRevision(row, revision);
        UUID articleUuid = parseUuid(articleId, "ARTICLE_ID_INVALID", "文章 ID 格式无效。");
        if (!collections.findRelatedIds(row.id()).contains(articleUuid))
            throw ApiException.notFound("COLLECTION_ARTICLE_NOT_FOUND", "合集内不存在这篇文章。");
        if (!collections.bumpRevision(row.id(), viewer.id(), revision)) throw revisionConflict();
        if (!collections.deleteRelation(row.id(), articleUuid)) throw revisionConflict();
        return detailById(row.id(), viewer);
    }

    @Transactional
    public Detail reorder(String id, List<UUID> articleIds, long revision, Principal principal) {
        var viewer = actor(principal);
        var row = editable(id, viewer);
        checkRevision(row, revision);
        if (articleIds == null) throw ApiException.badRequest("ARTICLE_IDS_REQUIRED", "请提供完整排序的文章 ID 列表。");
        if (articleIds.size() > MAX_ARTICLES) throw tooManyArticles();
        if (articleIds.stream().anyMatch(java.util.Objects::isNull))
            throw ApiException.badRequest("ARTICLE_ID_INVALID", "文章 ID 无效。");
        var unique = new LinkedHashSet<>(articleIds);
        if (unique.size() != articleIds.size())
            throw ApiException.conflict("DUPLICATE_ARTICLE_ID", "排序列表不能包含重复文章。");

        var current = visibleArticles(row, viewer).stream().map(ArticleCollectionRepository.ArticleRow::id).toList();
        if (current.size() > MAX_ARTICLES) throw tooManyArticles();
        if (!new HashSet<>(current).equals(unique) || current.size() != articleIds.size())
            throw ApiException.conflict("COLLECTION_ORDER_CHANGED", "合集文章已变化，请刷新后重新排序。");
        var hidden = collections.findHiddenRelatedIds(row, viewer);
        var completeStoredOrder = new ArrayList<UUID>(articleIds.size() + hidden.size());
        completeStoredOrder.addAll(articleIds);
        completeStoredOrder.addAll(hidden);
        if (completeStoredOrder.size() > MAX_ARTICLES) throw tooManyArticles();

        if (!collections.bumpRevision(row.id(), viewer.id(), revision)) throw revisionConflict();
        collections.rewriteOrder(row.id(), completeStoredOrder);
        return detailById(row.id(), viewer);
    }

    private BookKinUser actor(Principal principal) {
        if (principal == null) throw ApiException.forbidden("AUTH_REQUIRED", "请先登录。");
        return users.findByUsername(principal.getName())
                .orElseThrow(() -> ApiException.forbidden("AUTH_REQUIRED", "请先登录。"));
    }

    private ArticleCollectionRepository.CollectionRow readable(String rawId, BookKinUser viewer) {
        UUID id = parseUuid(rawId, "COLLECTION_ID_INVALID", "合集 ID 格式无效。");
        var row = collections.findReadableCollection(id, viewer);
        if (row == null) throw collectionNotFound();
        return row;
    }

    private ArticleCollectionRepository.CollectionRow editable(String rawId, BookKinUser viewer) {
        var row = readable(rawId, viewer);
        if (!row.ownerId().equals(viewer.id()))
            throw ApiException.forbidden("COLLECTION_EDIT_FORBIDDEN", "只有合集创建者可以编辑。");
        return row;
    }

    private Detail detailById(UUID id, BookKinUser viewer) {
        var row = collections.findReadableCollection(id, viewer);
        if (row == null) throw collectionNotFound();
        return detail(row, viewer);
    }

    private Detail detail(ArticleCollectionRepository.CollectionRow row, BookKinUser viewer) {
        return detail(row, viewer, visibleArticles(row, viewer));
    }

    private Detail detail(ArticleCollectionRepository.CollectionRow row, BookKinUser viewer,
                          List<ArticleCollectionRepository.ArticleRow> articles) {
        var summary = summary(row, viewer, articles);
        var articleViews = articles.stream().map(ArticleCollectionService::articleView).toList();
        return new Detail(summary.id(), summary.title(), summary.description(), summary.visibility(),
                summary.ownerDisplayName(), summary.ownedByViewer(), summary.editable(), summary.articleCount(),
                summary.previewArticles(), summary.revision(), summary.createdAt(), summary.updatedAt(), articleViews);
    }

    private Summary summary(ArticleCollectionRepository.CollectionRow row, BookKinUser viewer,
                            List<ArticleCollectionRepository.ArticleRow> articles) {
        if (articles.size() > MAX_ARTICLES) throw tooManyArticles();
        List<Map<String, Object>> preview = articles.stream().limit(MAX_PREVIEW_ARTICLES)
                .map(ArticleCollectionService::articleView).toList();
        boolean owned = row.ownerId().equals(viewer.id());
        return new Summary(row.id(), row.title(), row.description(), row.visibility(), row.ownerDisplayName(),
                owned, owned, articles.size(), preview, row.revision(), row.createdAt(), row.updatedAt());
    }

    private List<ArticleCollectionRepository.ArticleRow> visibleArticles(ArticleCollectionRepository.CollectionRow row,
                                                                          BookKinUser viewer) {
        var articles = collections.findVisibleArticles(row, viewer);
        if (articles.size() > MAX_ARTICLES) throw tooManyArticles();
        return articles;
    }

    private static Map<String, Object> articleView(ArticleCollectionRepository.ArticleRow article) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", article.id());
        result.put("title", article.title());
        result.put("author", article.author());
        result.put("source_url", article.sourceUrl());
        result.put("published_at", article.publishedAt());
        result.put("visibility", article.visibility());
        result.put("tags", article.tags());
        result.put("cover_url", article.coverUrl());
        result.put("created_at", article.createdAt());
        result.put("updated_at", article.updatedAt());
        return java.util.Collections.unmodifiableMap(result);
    }

    private static void checkRevision(ArticleCollectionRepository.CollectionRow row, long revision) {
        if (row.revision() != revision) throw revisionConflict();
    }

    private static String validTitle(String title) {
        if (title == null || title.isBlank() || title.trim().length() > 240)
            throw ApiException.badRequest("COLLECTION_TITLE_INVALID", "合集标题不能为空且不能超过 240 个字符。");
        return title.trim();
    }

    private static String validDescription(String description) {
        String value = description == null ? "" : description;
        if (value.length() > 4000) throw ApiException.badRequest("COLLECTION_DESCRIPTION_TOO_LONG", "合集说明不能超过 4000 个字符。");
        return value;
    }

    private static String validVisibility(String visibility) {
        if (!VISIBILITIES.contains(visibility)) throw ApiException.badRequest("COLLECTION_VISIBILITY_INVALID", "合集可见范围无效。");
        return visibility;
    }

    private static UUID parseUuid(String value, String code, String message) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException invalid) {
            throw ApiException.badRequest(code, message);
        }
    }

    private static ApiException collectionNotFound() {
        return ApiException.notFound("COLLECTION_NOT_FOUND", "合集不存在或无权访问。");
    }

    private static ApiException revisionConflict() {
        return ApiException.conflict("REVISION_CONFLICT", "合集已被其他操作更新，请刷新后重试。");
    }

    private static ApiException tooManyArticles() {
        return ApiException.badRequest("COLLECTION_ARTICLE_LIMIT", "每个合集最多包含 1000 篇文章。");
    }
}
