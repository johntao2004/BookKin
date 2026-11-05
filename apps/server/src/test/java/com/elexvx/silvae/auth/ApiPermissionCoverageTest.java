package com.elexvx.silvae.auth;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import com.elexvx.silvae.audit.AuditService;
import com.elexvx.silvae.users.UserRepository;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.web.bind.annotation.*;
/** Contract across actual controller routes: new endpoints must enter the permission catalog explicitly. */
class ApiPermissionCoverageTest {
    @Test void metadataSourcesUseExternalServiceSettingsGrants() {
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/metadata-providers")).isEqualTo(Set.of("settings.metadata.view"));
        assertThat(ApiPermissionPolicy.required("PUT", "/api/v1/metadata-providers")).isEqualTo(Set.of("settings.metadata.edit"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/books/example/metadata")).isEqualTo(Set.of("library.details.view"));
        assertThat(ApiPermissionPolicy.required("PUT", "/api/v1/books/example/metadata")).isEqualTo(Set.of("library.edit"));
        assertThat(ApiPermissionPolicy.required("POST", "/api/v1/book-uploads/example/match")).contains("library.upload");
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/ai/providers")).isEqualTo(Set.of("settings.ai.view"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/ai/settings")).isEqualTo(Set.of("settings.ai.view"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/ai/status")).isEmpty();
        assertThat(ApiPermissionPolicy.required("POST", "/api/v1/ai/test")).isEqualTo(Set.of("settings.ai.edit"));
    }
    @Test void bookClassificationDefersExactSourceGrantToItsService() {
        assertThat(ApiPermissionPolicy.required("POST", "/api/v1/ai/book-classification"))
                .isEqualTo(Set.of("reader.read", "library.edit", "library.upload"));
        assertThat(ApiPermissionPolicy.required("POST", "/api/v1/ai/book-knowledge"))
                .isEqualTo(Set.of("reader.read", "library.edit", "library.upload"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/knowledge/books/example"))
                .isEqualTo(Set.of("knowledge.view", "reader.read"));
    }
    @Test void collectionsHaveTheirOwnWriteGrantWithoutGrantingArticleEditing() {
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/article-collections")).isEqualTo(Set.of("articles.collections.view"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/article-collections/example")).isEqualTo(Set.of("articles.collections.details.view"));
        assertThat(ApiPermissionPolicy.required("POST", "/api/v1/article-collections/example/articles")).isEqualTo(Set.of("articles.collections.edit"));
        assertThat(ApiPermissionPolicy.required("DELETE", "/api/v1/articles/example")).isEqualTo(Set.of("articles.edit"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/articles")).isEqualTo(Set.of("articles.view"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/articles/example")).isEqualTo(Set.of("articles.read"));
    }
    @Test void notesAndBooklistPagesHaveIndependentApiScopesAndReaderKeepsBookBoundAnnotations() {
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/booklists")).isEqualTo(Set.of("booklists.view"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/booklists/example")).isEqualTo(Set.of("booklists.details.view"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/annotations/books")).isEqualTo(Set.of("notes.books.view"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/articles/notes")).isEqualTo(Set.of("notes.articles.view"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/reading-posts")).isEqualTo(Set.of("notes.posts.view"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/annotations", "bookId=00000000-0000-0000-0000-000000000001")).isEqualTo(Set.of("reader.read"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/annotations", "bookId=")).isEqualTo(Set.of("notes.view"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/annotations", "bookId=invalid")).isEqualTo(Set.of("notes.view"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/annotations", "q=needle")).isEqualTo(Set.of("notes.view"));
        assertThat(ApiPermissionPolicy.required("POST", "/api/v1/annotations")).isEqualTo(Set.of("reader.annotate"));
    }
    @Test void vaultOperationsUseIndependentGrantsWithoutChangingStepUpEndpoints() {
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/vault/config")).isEqualTo(Set.of("vault.use"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/vault/objects")).isEqualTo(Set.of("vault.read"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/vault/objects/00000000-0000-0000-0000-000000000001")).isEqualTo(Set.of("vault.read"));
        assertThat(ApiPermissionPolicy.required("POST", "/api/v1/vault/objects/00000000-0000-0000-0000-000000000001")).isEqualTo(Set.of("vault.upload"));
        assertThat(ApiPermissionPolicy.required("PUT", "/api/v1/vault/objects/00000000-0000-0000-0000-000000000001/chunks/0")).isEqualTo(Set.of("vault.upload"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/vault/objects/00000000-0000-0000-0000-000000000001/chunks/0")).isEqualTo(Set.of("vault.read"));
        assertThat(ApiPermissionPolicy.required("PUT", "/api/v1/vault/objects/00000000-0000-0000-0000-000000000001/state")).isEqualTo(Set.of("vault.read"));
        assertThat(ApiPermissionPolicy.required("DELETE", "/api/v1/vault/objects/00000000-0000-0000-0000-000000000001")).isEqualTo(Set.of("vault.delete"));
        assertThat(ApiPermissionPolicy.required("POST", "/api/v1/auth/two-factor/vault/verify")).isEqualTo(Set.of("vault.use"));
    }
    @Test void articleProgressEndpointKeepsReadGrantWhileAnnotationDeltaHasItsOwnGrant() {
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/articles/00000000-0000-0000-0000-000000000001/reading")).isEqualTo(Set.of("articles.read"));
        assertThat(ApiPermissionPolicy.required("PUT", "/api/v1/articles/00000000-0000-0000-0000-000000000001/reading")).isEqualTo(Set.of("articles.read"));
    }
    @Test void libraryAccessQueryAndDownloadAreIndependentAndPublicDiscoveryStillUsesQueryForSignedInUsers() {
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/books")).isEqualTo(Set.of("library.query"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/books/revision")).isEqualTo(Set.of("library.query"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/books/example")).isEqualTo(Set.of("library.details.view"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/books/example/content")).isEqualTo(Set.of("reader.read"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/books/example/download")).isEqualTo(Set.of("library.download"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/display-books")).isEqualTo(Set.of("library.query"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/display-books/example")).isEqualTo(Set.of("library.details.view"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/categories")).isEqualTo(Set.of("library.query"));
        var searchedBooks = ApiPermissionPolicy.required("GET", "/api/v1/books", "q=needle");
        assertThat(searchedBooks).isEqualTo(Set.of("library.query"));
        assertThat(Collections.disjoint(searchedBooks, Set.of("library.search.view"))).isTrue();
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/display-books", "q=needle")).isEqualTo(Set.of("library.query"));
    }
    @Test void everyActualApiEndpointHasAnExplicitPermissionClassification() throws Exception {
        var catalog = new RolePermissionService(mock(org.jooq.DSLContext.class),mock(UserRepository.class),mock(AuditService.class));
        var codes = catalog.defaults(com.elexvx.silvae.users.UserRole.OWNER);
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        var environment = new org.springframework.core.env.StandardEnvironment(); environment.setActiveProfiles("api"); scanner.setEnvironment(environment);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        int checked = 0;
        for (var bean : scanner.findCandidateComponents("com.elexvx.silvae")) {
            if (bean.getBeanClassName().contains("Test$") || bean.getBeanClassName().contains("Test.")) continue;
            var type = Class.forName(bean.getBeanClassName());
            var root = AnnotatedElementUtils.findMergedAnnotation(type, RequestMapping.class);
            var prefixes = root == null || root.value().length == 0 ? new String[]{""} : root.value();
            for (var method : type.getDeclaredMethods()) {
                var mapping = AnnotatedElementUtils.findMergedAnnotation(method, RequestMapping.class);
                if (mapping == null) continue;
                var paths = mapping.value().length == 0 ? new String[]{""} : mapping.value();
                var verbs = mapping.method().length == 0 ? new RequestMethod[]{RequestMethod.GET} : mapping.method();
                for (var prefix : prefixes) for (var path : paths) for (var verb : verbs) {
                    String uri = prefix + path; if (!uri.startsWith("/api/v1/")) continue;
                    var required = ApiPermissionPolicy.required(verb.name(), uri);
                    assertThat(codes).as(verb+" "+uri).containsAll(required);
                    if (!uri.startsWith("/api/v1/role-permissions") && !uri.matches("/api/v1/users/[^/]+/role"))
                        assertThat(required).as("Unclassified endpoint: "+verb+" "+uri).isNotEqualTo(Set.of("roles.manage"));
                    checked++;
                }
            }
        }
        assertThat(checked).isGreaterThan(100);
    }
}
