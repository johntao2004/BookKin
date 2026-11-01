package com.elexvx.bookkin.articles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.auth.RolePermissionService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.infrastructure.PrivateContentStore;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import com.elexvx.bookkin.users.UserRole;
import com.elexvx.bookkin.users.UserStatus;
import java.security.Principal;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class ArticleReadingAnnotationPermissionTest {
    private static final UUID USER_ID = UUID.fromString("00000000-0000-4000-8000-000000000010");
    private static final UUID ARTICLE_ID = UUID.fromString("00000000-0000-4000-8000-000000000020");
    private static final String ARTICLE_SQL = "select * from articles where id=? and (visibility='PUBLIC' or owner_id=? or ?)";
    private static final String STATE_SQL = "select state::text from article_reading where article_id=? and user_id=?";

    @Test void readerAnnotateCannotWriteArticleNotesButProgressRemainsWritable() {
        var db = mock(DSLContext.class);
        var users = mock(UserRepository.class);
        var article = mock(Record.class);
        var state = mock(Record.class);
        var policy = mock(Record.class);
        var user = new BookKinUser(USER_ID, "member", "Member", "unused", UserRole.MEMBER, UserStatus.ACTIVE, false, null, null);
        when(users.findByUsername("member")).thenReturn(Optional.of(user));
        when(article.intoMap()).thenReturn(Map.of("id", ARTICLE_ID, "title", "Article"));
        when(state.get("state", String.class)).thenReturn("{\"progress\":0.1,\"annotations\":[]}");
        when(policy.get("revision", Long.class)).thenReturn(1L);
        when(policy.get("grants", String.class)).thenReturn("{\"_permissionModelVersion\":4,\"grants\":{\"ADMIN\":[],\"MEMBER\":[\"articles.read\",\"library.view\",\"reader.read\",\"reader.annotate\"]}}");
        when(db.fetchOne(eq(ARTICLE_SQL), eq(ARTICLE_ID), eq(USER_ID), eq(false))).thenReturn(article);
        when(db.fetchOne(eq(STATE_SQL), eq(ARTICLE_ID), eq(USER_ID))).thenReturn(state);
        when(db.fetchOne("select revision, grants::text as grants from role_permission_policy where id = 1")).thenReturn(policy);
        var permissions = new RolePermissionService(db, users, mock(AuditService.class));
        Principal principal = () -> "member";
        var service = new ArticleService(db, users, (PublicWebFetcher) null, (PrivateContentStore) null,
                (AiMetadataService) null, new ObjectMapper(), permissions);

        assertThatThrownBy(() -> service.reading(ARTICLE_ID,
                "{\"progress\":0.2,\"annotations\":[{\"id\":\"bookmark-1\"}]}", 1, principal))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("PERMISSION_DENIED"));
        service.reading(ARTICLE_ID, "{\"progress\":0.8,\"annotations\":[]}", 1, principal);
    }
}
