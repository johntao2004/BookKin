package com.elexvx.bookkin.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.users.UserRepository;
import com.elexvx.bookkin.users.UserRole;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.junit.jupiter.api.Test;

class RolePermissionServiceCompatibilityTest {
    private RolePermissionService serviceFor(String grants) {
        var dsl = mock(DSLContext.class);
        var row = mock(Record.class);
        when(dsl.fetchOne(org.mockito.ArgumentMatchers.anyString())).thenReturn(row);
        when(row.get("revision", Long.class)).thenReturn(3L);
        when(row.get("grants", String.class)).thenReturn(grants);
        return new RolePermissionService(dsl, mock(UserRepository.class), mock(AuditService.class));
    }

    @Test void legacyPoliciesInheritQueryAndDownloadFromTheirFormerCapabilities() {
        var policy = serviceFor("{\"ADMIN\":[\"library.view\",\"reader.read\"],\"MEMBER\":[\"library.view\",\"reader.read\"]}").policy();
        assertThat(policy.grants().get(UserRole.ADMIN)).contains("library.query", "library.download");
        assertThat(policy.grants().get(UserRole.MEMBER)).contains("library.query", "library.download").doesNotContain("library.files");
    }

    @Test void versionedPoliciesKeepNewCapabilityRevocationsAndApplyRoleCeilings() {
        var policy = serviceFor("{\"_permissionModelVersion\":2,\"grants\":{\"ADMIN\":[\"library.view\",\"reader.read\",\"booklists.view\",\"articles.view\",\"notes.view\",\"settings.ai.view\",\"settings.ai.edit\"],\"MEMBER\":[\"library.view\",\"reader.read\",\"library.files\"]}}").policy();
        assertThat(policy.grants().get(UserRole.ADMIN)).doesNotContain("library.query", "library.download");
        assertThat(policy.grants().get(UserRole.MEMBER)).doesNotContain("library.query", "library.download", "library.files");
        assertThat(policy.grants().get(UserRole.ADMIN)).contains("library.details.view", "booklists.details.view", "articles.read", "articles.annotate", "articles.collections.view",
            "articles.collections.details.view", "notes.books.view", "notes.articles.view", "notes.posts.view", "settings.metadata.view", "settings.metadata.edit");
        assertThat(policy.grants().get(UserRole.ADMIN)).doesNotContain("library.search.view");
    }

    @Test void versionThreeDoesNotRestoreIndependentlyRevokedPageScopes() {
        var policy = serviceFor("{\"_permissionModelVersion\":3,\"grants\":{\"ADMIN\":[\"library.view\",\"articles.view\",\"articles.collections.view\",\"booklists.view\",\"notes.view\",\"notes.posts.view\",\"settings.ai.view\"]}}").policy();
        assertThat(policy.grants().get(UserRole.ADMIN)).doesNotContain("library.details.view", "articles.read",
            "booklists.details.view", "notes.books.view", "notes.articles.view", "settings.metadata.view");
        assertThat(policy.grants().get(UserRole.ADMIN)).contains("articles.collections.view", "notes.posts.view")
            .doesNotContain("articles.collections.details.view", "notes.books.view");
    }

    @Test void v3InheritsArticleAnnotationsAndVaultActionsButV4KeepsTheirRevocations() {
        var v3 = serviceFor("{\"_permissionModelVersion\":3,\"grants\":{\"ADMIN\":[\"articles.read\",\"vault.use\"],\"MEMBER\":[\"articles.view\",\"vault.use\"]}}").policy();
        assertThat(v3.grants().get(UserRole.ADMIN)).contains("articles.annotate", "vault.read", "vault.upload", "vault.delete");
        var v4 = serviceFor("{\"_permissionModelVersion\":4,\"grants\":{\"ADMIN\":[\"articles.read\",\"library.view\",\"reader.read\",\"reader.annotate\",\"vault.use\"],\"MEMBER\":[\"articles.read\",\"library.view\",\"reader.read\",\"reader.annotate\",\"vault.use\"]}}").policy();
        assertThat(v4.grants().get(UserRole.ADMIN)).doesNotContain("articles.annotate", "vault.read", "vault.upload", "vault.delete");
        assertThat(v4.grants().get(UserRole.ADMIN)).contains("reader.annotate");
    }
}
