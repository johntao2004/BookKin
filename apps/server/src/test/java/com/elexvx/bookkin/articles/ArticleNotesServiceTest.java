package com.elexvx.bookkin.articles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import com.elexvx.bookkin.users.UserRole;
import com.elexvx.bookkin.users.UserStatus;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.jooq.tools.jdbc.MockConnection;
import org.jooq.tools.jdbc.MockResult;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class ArticleNotesServiceTest {
    @Test
    void notesAreFetchedForTheCurrentUserAndMalformedEntriesAreFiltered() {
        UUID userId = UUID.randomUUID();
        UUID articleId = UUID.randomUUID();
        UUID coverId = UUID.randomUUID();
        String state = """
                {"annotations":[
                  {"id":"entry-1","type":"NOTE","quote":"摘录","note":"想法","locator":"p-2","style":"BOLD","color":"TEAL","createdAt":"2026-10-22T10:00:00Z"},
                  {"id":"defaults","type":"HIGHLIGHT","quote":"默认样式","note":"","locator":"p-7","createdAt":"2026-10-22T10:00:00Z"},
                  {"id":"bookmark","type":"BOOKMARK","quote":"","note":"","locator":"p-3","createdAt":"2026-10-22T10:00:00Z"},
                  {"id":"empty","type":"HIGHLIGHT","quote":" ","note":"","locator":"p-4","createdAt":"2026-10-22T10:00:00Z"},
                  {"id":"bad-style","type":"HIGHLIGHT","quote":"摘录","note":"","locator":"p-5","style":"SCRIPT","createdAt":"2026-10-22T10:00:00Z"},
                  {"id":"bad-date","type":"NOTE","quote":"摘录","note":"不能解析的日期","locator":"p-8","createdAt":"not-a-date"},
                  {"id":4,"type":"NOTE","quote":"摘录","note":"错误 ID","locator":"p-6","createdAt":"2026-10-22T10:00:00Z"}
                ]}
                """;
        var articleIdField = DSL.field("article_id", UUID.class);
        var titleField = DSL.field("title", String.class);
        var authorField = DSL.field("author", String.class);
        var coverField = DSL.field("cover_asset_id", UUID.class);
        var stateField = DSL.field("state", String.class);
        var rows = DSL.using(SQLDialect.POSTGRES).newResult(articleIdField, titleField, authorField, coverField, stateField);
        var row = DSL.using(SQLDialect.POSTGRES).newRecord(articleIdField, titleField, authorField, coverField, stateField);
        row.setValue(articleIdField, articleId);
        row.setValue(titleField, "文章标题");
        row.setValue(authorField, "作者");
        row.setValue(coverField, coverId);
        row.setValue(stateField, state);
        rows.add(row);

        var connection = new MockConnection(context -> {
            assertThat(context.sql()).contains("ar.user_id = ?", "a.visibility = 'PUBLIC'", "a.owner_id = ?");
            assertThat(context.bindings()).containsExactly(userId, userId, false);
            return new MockResult[] {new MockResult(1, rows)};
        });
        var db = DSL.using(connection, SQLDialect.POSTGRES);
        var users = org.mockito.Mockito.mock(UserRepository.class);
        when(users.findByUsername("reader")).thenReturn(Optional.of(user(userId, "reader")));

        var result = new ArticleNotesService(db, users, new ObjectMapper()).notes(() -> "reader");

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().articleId()).isEqualTo(articleId);
        assertThat(result.getFirst().coverUrl()).isEqualTo("/api/v1/articles/assets/" + coverId);
        assertThat(result.getFirst().annotations()).containsExactly(
                new ArticleNotesService.Entry("entry-1", "NOTE", "摘录", "想法", "p-2", "BOLD", "TEAL", "2026-10-22T10:00:00Z"),
                new ArticleNotesService.Entry("defaults", "HIGHLIGHT", "默认样式", "", "p-7", "HIGHLIGHT", "YELLOW", "2026-10-22T10:00:00Z"));
        verify(users).findByUsername("reader");
    }

    @Test
    void malformedStateDoesNotFailTheFeedOrReturnUnvalidatedData() {
        var service = new ArticleNotesService(null, null, new ObjectMapper());
        assertThat(service.parseEntries("not-json")).isEmpty();
        assertThat(service.parseEntries("{\"annotations\":{\"private\":true}}" )).isEmpty();
    }

    private static BookKinUser user(UUID id, String username) {
        return new BookKinUser(id, username, "读者", "hash", UserRole.MEMBER, UserStatus.ACTIVE,
                false, OffsetDateTime.now(), null);
    }
}
