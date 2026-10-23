package com.elexvx.bookkin.articles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import com.elexvx.bookkin.users.UserRole;
import com.elexvx.bookkin.users.UserStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ArticleCollectionServiceTest {
    private static final UUID VIEWER_ID = UUID.randomUUID();
    private static final java.security.Principal VIEWER = () -> "viewer";
    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-10-23T01:02:03Z");

    @Test
    void privateCollectionsAreHiddenFromOtherMembersAndAdministrators() {
        var repo = mock(ArticleCollectionRepository.class);
        var users = users(viewer(UserRole.ADMIN));
        var service = new ArticleCollectionService(repo, users);
        UUID id = UUID.randomUUID();
        when(repo.findReadableCollection(id, viewer(UserRole.ADMIN))).thenReturn(null);

        assertApi("COLLECTION_NOT_FOUND", () -> service.get(id.toString(), VIEWER));
        verify(repo).findReadableCollection(id, viewer(UserRole.ADMIN));
        verifyNoMoreInteractions(repo);
    }

    @Test
    void sharedCollectionResponseUsesOnlyTheVisibleArticlesAndNeverReturnsBodyFields() {
        var repo = mock(ArticleCollectionRepository.class);
        var users = users(viewer(UserRole.MEMBER));
        var service = new ArticleCollectionService(repo, users);
        UUID collectionId = UUID.randomUUID();
        UUID publicId = UUID.randomUUID();
        UUID privateId = UUID.randomUUID();
        var collection = collection(collectionId, UUID.randomUUID(), "MEMBERS", 2);
        var visible = article(publicId, "PUBLIC", "公开文章");
        when(repo.findReadableCollection(collectionId, viewer(UserRole.MEMBER))).thenReturn(collection);
        when(repo.findVisibleArticles(collection, viewer(UserRole.MEMBER))).thenReturn(List.of(visible));

        var result = service.get(collectionId.toString(), VIEWER);

        assertThat(result.articleCount()).isEqualTo(1);
        assertThat(result.previewArticles()).extracting(article -> article.get("id")).containsExactly(publicId);
        assertThat(result.articles()).extracting(article -> article.get("id")).containsExactly(publicId);
        assertThat(result.articles().getFirst()).containsOnlyKeys("id", "title", "author", "source_url", "published_at",
                "visibility", "tags", "cover_url", "created_at", "updated_at");
        assertThat(result.articles()).noneMatch(article -> privateId.equals(article.get("id")));
    }

    @Test
    void failedSharedBatchDoesNotBumpRevisionAndDuplicateNewIdsAreStoredOnce() {
        var repo = mock(ArticleCollectionRepository.class);
        var users = users(viewer(UserRole.MEMBER));
        var service = new ArticleCollectionService(repo, users);
        UUID collectionId = UUID.randomUUID();
        UUID publicId = UUID.randomUUID();
        UUID privateId = UUID.randomUUID();
        var collection = collection(collectionId, VIEWER_ID, "MEMBERS", 4);
        when(repo.findReadableCollection(collectionId, viewer(UserRole.MEMBER))).thenReturn(collection);
        when(repo.findRelatedIds(collectionId)).thenReturn(List.of());
        when(repo.findSources(List.of(publicId, privateId), viewer(UserRole.MEMBER), false, true))
                .thenReturn(List.of(new ArticleCollectionRepository.ArticleSource(publicId, VIEWER_ID, "PUBLIC"),
                        new ArticleCollectionRepository.ArticleSource(privateId, VIEWER_ID, "PRIVATE")));

        assertApi("COLLECTION_ARTICLE_NOT_PUBLIC", () -> service.addArticles(collectionId.toString(),
                List.of(publicId, privateId), 4, VIEWER));
        verify(repo, never()).bumpRevision(any(), any(), anyLong());
        verify(repo, never()).insertRelation(any(), any(), anyInt());
        assertApi("DUPLICATE_ARTICLE_ID", () -> service.addArticles(collectionId.toString(),
                List.of(publicId, publicId), 4, VIEWER));
        verify(repo, never()).bumpRevision(any(), any(), anyLong());

        reset(repo);
        when(repo.findReadableCollection(collectionId, viewer(UserRole.MEMBER)))
                .thenReturn(collection, collection(collectionId, VIEWER_ID, "MEMBERS", 5));
        when(repo.findRelatedIds(collectionId)).thenReturn(List.of());
        when(repo.findSources(List.of(publicId), viewer(UserRole.MEMBER), false, true))
                .thenReturn(List.of(new ArticleCollectionRepository.ArticleSource(publicId, VIEWER_ID, "PUBLIC")));
        when(repo.bumpRevision(collectionId, VIEWER_ID, 4)).thenReturn(true);
        when(repo.findVisibleArticles(any(), eq(viewer(UserRole.MEMBER)))).thenReturn(List.of(article(publicId, "PUBLIC", "公开文章")));

        var result = service.addArticles(collectionId.toString(), List.of(publicId), 4, VIEWER);

        assertThat(result.articleCount()).isEqualTo(1);
        verify(repo).insertRelation(collectionId, publicId, 0);
        verify(repo, times(1)).insertRelation(any(), any(), anyInt());
    }

    @Test
    void revisionAndCompleteOrderAreCheckedBeforeAnyMutation() {
        var repo = mock(ArticleCollectionRepository.class);
        var users = users(viewer(UserRole.MEMBER));
        var service = new ArticleCollectionService(repo, users);
        UUID collectionId = UUID.randomUUID();
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        var collection = collection(collectionId, VIEWER_ID, "PRIVATE", 7);
        when(repo.findReadableCollection(collectionId, viewer(UserRole.MEMBER))).thenReturn(collection);

        assertApi("REVISION_CONFLICT", () -> service.reorder(collectionId.toString(), List.of(first, second), 6, VIEWER));
        verify(repo, never()).bumpRevision(any(), any(), anyLong());

        when(repo.findVisibleArticles(collection, viewer(UserRole.MEMBER))).thenReturn(List.of(article(first, "PUBLIC", "一"), article(second, "PUBLIC", "二")));
        assertApi("COLLECTION_ORDER_CHANGED", () -> service.reorder(collectionId.toString(), List.of(first), 7, VIEWER));
        verify(repo, never()).rewriteOrder(any(), anyList());

        assertApi("DUPLICATE_ARTICLE_ID", () -> service.reorder(collectionId.toString(), List.of(first, first), 7, VIEWER));
        verify(repo, never()).bumpRevision(any(), any(), anyLong());
    }

    @Test
    void invalidPathUuidIsRejectedAsBadRequest() {
        var service = new ArticleCollectionService(mock(ArticleCollectionRepository.class), users(viewer(UserRole.MEMBER)));
        assertApi("COLLECTION_ID_INVALID", () -> service.get("not-a-uuid", VIEWER));
    }

    private static UserRepository users(BookKinUser viewer) {
        var users = mock(UserRepository.class);
        when(users.findByUsername("viewer")).thenReturn(Optional.of(viewer));
        return users;
    }

    private static BookKinUser viewer(UserRole role) {
        return new BookKinUser(VIEWER_ID, "viewer", "查看者", "hash", role, UserStatus.ACTIVE, false, NOW, null);
    }

    private static ArticleCollectionRepository.CollectionRow collection(UUID id, UUID owner, String visibility, long revision) {
        return new ArticleCollectionRepository.CollectionRow(id, owner, "选集", "说明", visibility, revision, NOW, NOW, "创建者");
    }

    private static ArticleCollectionRepository.ArticleRow article(UUID id, String visibility, String title) {
        return new ArticleCollectionRepository.ArticleRow(id, title, "作者", "https://example.test", "", visibility,
                "标签", null, NOW, NOW);
    }

    private static void assertApi(String code, org.assertj.core.api.ThrowableAssert.ThrowingCallable action) {
        int expectedStatus = switch (code) {
            case "COLLECTION_NOT_FOUND", "ARTICLE_NOT_FOUND", "COLLECTION_ARTICLE_NOT_FOUND" -> 404;
            case "COLLECTION_EDIT_FORBIDDEN" -> 403;
            case "COLLECTION_ID_INVALID" -> 400;
            default -> 409;
        };
        assertThatThrownBy(action).isInstanceOfSatisfying(ApiException.class, error -> {
            assertThat(error.code()).isEqualTo(code);
            assertThat(error.status().value()).isEqualTo(expectedStatus);
        });
    }
}
