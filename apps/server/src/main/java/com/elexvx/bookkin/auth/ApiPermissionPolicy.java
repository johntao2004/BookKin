package com.elexvx.bookkin.auth;
import java.util.Set;
/** Every API family is classified here. Empty is limited to identity/bootstrap and shared public assets. */
public final class ApiPermissionPolicy {
    private ApiPermissionPolicy() {}
    public static Set<String> required(String method, String uri) {
        String p = uri.substring("/api/v1".length());
        boolean read = method.equals("GET") || method.equals("HEAD");
        if (p.startsWith("/auth/two-factor/")) return Set.of("vault.use");
        if (p.startsWith("/auth/")) return Set.of();
        if (p.equals("/site-settings") || p.equals("/site-settings/robots.txt")) return read ? Set.of() : Set.of("settings.site.edit");
        if (p.startsWith("/role-permissions") || p.matches("/users/[^/]+/role")) return Set.of("roles.manage");
        if (p.equals("/metadata-providers")) return Set.of("settings.ai." + (read ? "view" : "edit"));
        if (p.startsWith("/users/login-logs")) return Set.of("settings.logs.view");
        if (p.startsWith("/users/active-sessions")) return Set.of("settings.sessions.view");
        if (p.matches("/users/[^/]+/sessions/revoke")) return Set.of("settings.sessions.revoke", "settings.users.manage");
        if (p.equals("/users/security-settings") || p.equals("/users/session-policy") || p.equals("/users/password-policy") || p.equals("/users/vault-policy"))
            return Set.of("settings.security." + (read ? "view" : "edit"));
        if (p.equals("/users") || p.startsWith("/users/")) return Set.of("settings.users." + (read ? "view" : p.equals("/users") ? "create" : "manage"));
        if (p.startsWith("/mail/")) return Set.of("settings.mail." + (read ? "view" : "edit"));
        if (p.equals("/ai/providers")) return Set.of("settings.ai.view", "library.upload", "library.edit", "knowledge.generate");
        // The endpoint has source-specific authorization in its service; this route gate admits each valid source grant.
        if (p.equals("/metadata-terms") || p.equals("/metadata-terms/ensure")) return Set.of("library.edit", "library.upload");
        if (p.equals("/ai/metadata-terms")) return Set.of("reader.read", "library.edit", "library.upload");
        if (p.equals("/ai/book-classification")) return Set.of("reader.read", "library.edit", "library.upload");
        if (p.equals("/ai/book-knowledge")) return Set.of("reader.read", "library.edit", "library.upload");
        if (read && p.matches("/knowledge/books/[^/]+")) return Set.of("knowledge.view", "reader.read");
        // The assistance service additionally requires the exact source/action grant and object access.
        if (p.equals("/ai/assistance")) return Set.of("reader.read", "articles.view", "notes.edit", "articles.edit", "library.edit", "library.upload");
        if (p.startsWith("/ai/")) return Set.of("settings.ai." + (read ? "view" : "edit"));
        if (p.startsWith("/vault/")) return Set.of("vault.use");
        if (p.equals("/library-roots/content-storage")) return Set.of("settings.roots.view");
        if (p.startsWith("/library-roots")) return !read ? Set.of("settings.roots.edit") : Set.of("settings.roots.view", "library.upload", "library.files");
        if (p.startsWith("/book-uploads")) return Set.of("library.upload");
        if (p.startsWith("/recycle-bin")) return Set.of("settings.recycle." + (read ? "view" : method.equals("DELETE") ? "purge" : "restore"));
        // Actual preview/execute action is checked against the server-side preview type by FileOperationService.
        if (p.startsWith("/file-operations")) return read && p.equals("/file-operations") ? Set.of("settings.operations.view")
            : Set.of("library.files", "library.trash", "settings.recycle.restore", "settings.recycle.purge");
        if (p.startsWith("/knowledge")) return Set.of(read ? "knowledge.view" : "knowledge.generate");
        if (p.startsWith("/article-collections")) return Set.of(read ? "articles.view" : "articles.collections.edit");
        if (p.equals("/articles/notes")) return Set.of("notes.view");
        if (p.startsWith("/articles")) {
            if (p.matches("/articles/[^/]+/reading")) return Set.of("articles.view");
            if (!read && p.matches("/articles/[^/]+/knowledge")) return Set.of("articles.analyze");
            return Set.of(read ? "articles.view" : "articles.edit");
        }
        if (p.startsWith("/booklists")) return Set.of(read ? "booklists.view" : "booklists.edit");
        if (p.startsWith("/categories") || p.matches("/books/[^/]+/categories")) return Set.of(read ? "library.view" : "library.organize");
        if (p.startsWith("/annotations")) return read ? Set.of("notes.view", "reader.read") : Set.of("reader.annotate");
        if (p.startsWith("/reading-posts") || p.startsWith("/book-reviews") || p.matches("/books/[^/]+/reviews"))
            return Set.of(read ? "notes.view" : "notes.edit");
        if (p.equals("/reading-overview") || p.startsWith("/reading-stats")) return Set.of("library.overview");
        if (p.startsWith("/reader-fonts")) return read ? Set.of("reader.read", "settings.fonts.view") : Set.of("settings.fonts.edit");
        if (p.matches("/(books|display-books)/[^/]+/(content|position|reading-time)")) return Set.of("reader.read");
        if (p.startsWith("/display-books")) return Set.of(read ? "library.view" : "library.edit");
        if (p.startsWith("/books")) return Set.of(read ? "library.view" : "library.edit");
        return Set.of("roles.manage"); // Unknown future APIs are closed to delegated roles until explicitly classified.
    }
}
