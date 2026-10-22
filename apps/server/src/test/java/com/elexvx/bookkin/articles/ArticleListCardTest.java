package com.elexvx.bookkin.articles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.filemanagement.infrastructure.PrivateContentStore;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.jooq.tools.jdbc.MockConnection;
import org.jooq.tools.jdbc.MockResult;
import org.junit.jupiter.api.Test;

class ArticleListCardTest {
    @Test
    void listReturnsSafeCardMetadataAndKeepsTheExistingVisibilityFilter() {
        UUID ownerId = UUID.randomUUID();
        UUID articleId = UUID.randomUUID();
        UUID explicitCoverAssetId = UUID.randomUUID();
        UUID unlinkedAssetId = UUID.randomUUID();
        UUID firstLinkedAssetId = UUID.randomUUID();
        UUID laterLinkedAssetId = UUID.randomUUID();
        String articleText = "摘".repeat(199) + "😀" + "尾";
        String html = "<p>" + articleText + "</p><script>脚本泄漏</script><style>样式泄漏</style>"
                + "<img src='https://evil.test/remote.png'>"
                + "<img src='/api/v1/articles/assets/" + unlinkedAssetId + "'>"
                + "<img src='/api/v1/articles/assets/" + firstLinkedAssetId + "'>"
                + "<img src='/api/v1/articles/assets/" + laterLinkedAssetId + "'>";

        var database = DSL.using(new MockConnection(context -> {
            assertThat(context.sql()).contains("a.visibility='PUBLIC'", "a.owner_id=?", "or ?", "limit 500");
            assertThat(context.bindings()).containsExactly(ownerId, false);

            var dsl = DSL.using(SQLDialect.POSTGRES);
            var idField = DSL.field("id", UUID.class);
            var titleField = DSL.field("title", String.class);
            var authorField = DSL.field("author", String.class);
            var sourceUrlField = DSL.field("source_url", String.class);
            var publishedAtField = DSL.field("published_at", String.class);
            var visibilityField = DSL.field("visibility", String.class);
            var tagsField = DSL.field("tags", String.class);
            var createdAtField = DSL.field("created_at", OffsetDateTime.class);
            var updatedAtField = DSL.field("updated_at", OffsetDateTime.class);
            var ownerField = DSL.field("owner_id", UUID.class);
            var coverAssetField = DSL.field("cover_asset_id", UUID.class);
            var htmlField = DSL.field("html", String.class);
            var result = dsl.newResult(idField, titleField, authorField, sourceUrlField, publishedAtField,
                    visibilityField, tagsField, createdAtField, updatedAtField, ownerField, htmlField, coverAssetField);
            var row = dsl.newRecord(idField, titleField, authorField, sourceUrlField, publishedAtField,
                    visibilityField, tagsField, createdAtField, updatedAtField, ownerField, htmlField, coverAssetField);
            row.set(idField, articleId);
            row.set(titleField, "列表文章");
            row.set(authorField, "作者");
            row.set(sourceUrlField, "https://example.test/article");
            row.set(publishedAtField, "");
            row.set(visibilityField, "PUBLIC");
            row.set(tagsField, "");
            row.set(createdAtField, OffsetDateTime.parse("2026-10-20T00:00:00Z"));
            row.set(updatedAtField, OffsetDateTime.parse("2026-10-20T00:00:00Z"));
            row.set(ownerField, ownerId);
            row.set(htmlField, html);
            row.set(coverAssetField, explicitCoverAssetId);
            result.add(row);
            return new MockResult[] {new MockResult(1, result)};
        }), SQLDialect.POSTGRES);

        var reader = mock(BookKinUser.class);
        when(reader.id()).thenReturn(ownerId);
        when(reader.canManageFiles()).thenReturn(false);
        var users = mock(UserRepository.class);
        when(users.findByUsername("reader")).thenReturn(Optional.of(reader));
        ArticleService service = new ArticleService(database, users, null, (PrivateContentStore) null,
                (AiMetadataService) null, null);

        var cards = service.list((Principal) () -> "reader");

        assertThat(cards).hasSize(1);
        var card = cards.get(0);
        assertThat(card).containsEntry("cover_url", "/api/v1/articles/assets/" + explicitCoverAssetId);
        assertThat(card).containsEntry("excerpt", "摘".repeat(199) + "😀");
        assertThat(card).doesNotContainKeys("html", "linked_asset_ids", "cover_asset_id");
        assertThat(card.get("cover_url")).isNotEqualTo("/api/v1/articles/assets/" + firstLinkedAssetId);
        assertThat(card.get("excerpt").toString()).doesNotContain("脚本泄漏", "样式泄漏");
    }
}
