package com.elexvx.bookkin.auth;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.users.UserRepository;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.web.bind.annotation.*;
/** Contract across actual controller routes: new endpoints must enter the permission catalog explicitly. */
class ApiPermissionCoverageTest {
    @Test void collectionsHaveTheirOwnWriteGrantWithoutGrantingArticleEditing() {
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/article-collections/example")).isEqualTo(Set.of("articles.view"));
        assertThat(ApiPermissionPolicy.required("POST", "/api/v1/article-collections/example/articles")).isEqualTo(Set.of("articles.collections.edit"));
        assertThat(ApiPermissionPolicy.required("DELETE", "/api/v1/articles/example")).isEqualTo(Set.of("articles.edit"));
    }
    @Test void everyActualApiEndpointHasAnExplicitPermissionClassification() throws Exception {
        var catalog = new RolePermissionService(mock(org.jooq.DSLContext.class),mock(UserRepository.class),mock(AuditService.class));
        var codes = catalog.defaults(com.elexvx.bookkin.users.UserRole.OWNER);
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        var environment = new org.springframework.core.env.StandardEnvironment(); environment.setActiveProfiles("api"); scanner.setEnvironment(environment);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        int checked = 0;
        for (var bean : scanner.findCandidateComponents("com.elexvx.bookkin")) {
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
