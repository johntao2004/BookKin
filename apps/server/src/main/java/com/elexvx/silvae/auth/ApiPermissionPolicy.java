package com.elexvx.silvae.auth;
import java.util.Set;
/** Every API family is classified here. Empty is limited to identity/bootstrap and shared public assets. */
public final class ApiPermissionPolicy {
    private ApiPermissionPolicy() {}
    public static Set<String> required(String method, String uri) {
        return required(method, uri, "");
    }
    public static Set<String> required(String method, String uri, String queryString) {
        String p = uri.substring("/api/v1".length());
        boolean read = method.equals("GET") || method.equals("HEAD");
        queryString = queryString == null ? "" : queryString;
        boolean hasBookId = hasValidBookId(queryString);
        if (p.startsWith("/auth/two-factor/")) return Set.of("vault.use");
        if (p.startsWith("/auth/")) return Set.of();
        if (p.equals("/site-settings") || p.equals("/site-settings/robots.txt")) return read ? Set.of() : Set.of("settings.site.edit");
        if (p.startsWith("/role-permissions") || p.matches("/users/[^/]+/role")) return Set.of("roles.manage");
        if (p.equals("/metadata-providers")) return Set.of("settings.metadata." + (read ? "view" : "edit"));
        if (p.startsWith("/users/login-logs")) return Set.of("settings.logs.view");
        if (p.startsWith("/users/active-sessions")) return Set.of("settings.sessions.view");
        if (p.matches("/users/[^/]+/sessions/revoke")) return Set.of("settings.sessions.revoke", "settings.users.manage");
        if (p.equals("/users/security-settings") || p.equals("/users/session-policy") || p.equals("/users/password-policy") || p.equals("/users/vault-policy"))
            return Set.of("settings.security." + (read ? "view" : "edit"));
        if (p.equals("/users") || p.startsWith("/users/")) return Set.of("settings.users." + (read ? "view" : p.equals("/users") ? "create" : "manage"));
        if (p.startsWith("/mail/")) return Set.of("settings.mail." + (read ? "view" : "edit"));
        // The endpoint has source-specific authorization in its service; this route gate admits each valid source grant.
        if (p.equals("/metadata-terms") || p.equals("/metadata-terms/ensure")) return Set.of("library.edit", "library.upload");
        if (p.equals("/ai/metadata-terms")) return Set.of("reader.read", "library.edit", "library.upload");
        if (p.equals("/ai/book-classification")) return Set.of("reader.read", "library.edit", "library.upload");
        if (p.equals("/ai/book-knowledge")) return Set.of("reader.read", "library.edit", "library.upload");
        if (p.equals("/ai/status")) return Set.of(); // Authenticated users may learn whether AI actions are configured; no settings are exposed.
        if (read && p.matches("/knowledge/books/[^/]+")) return Set.of("knowledge.view", "reader.read");
        // The assistance service additionally requires the exact source/action grant and object access.
        if (p.equals("/ai/assistance")) return Set.of("reader.read", "articles.view", "notes.edit", "articles.edit", "library.edit", "library.upload");
        if (p.startsWith("/ai/")) return Set.of("settings.ai." + (read ? "view" : "edit"));
        if (p.matches("/vault/objects/[^/]+/chunks/[0-9]+") && method.equals("PUT")) return Set.of("vault.upload");
        if (p.matches("/vault/objects/[^/]+/chunks/[0-9]+") && read) return Set.of("vault.read");
        if (p.equals("/vault/objects") && read) return Set.of("vault.read");
        if (p.matches("/vault/objects/[^/]+") && read) return Set.of("vault.read");
        if (p.matches("/vault/objects/[^/]+") && method.equals("POST")) return Set.of("vault.upload");
        if (p.matches("/vault/objects/[^/]+") && method.equals("DELETE")) return Set.of("vault.delete");
        if (p.matches("/vault/objects/[^/]+/state") && !read) return Set.of("vault.read");
        if (p.startsWith("/vault/")) return Set.of("vault.use");
        if (p.equals("/library-roots/content-storage")) return Set.of("settings.roots.view");
        if (p.startsWith("/library-roots")) return !read ? Set.of("settings.roots.edit") : Set.of("settings.roots.view", "library.upload", "library.files");
        if (p.startsWith("/book-uploads")) return Set.of(read ? "library.view" : "library.upload");
        if (p.startsWith("/recycle-bin")) return Set.of("settings.recycle." + (read ? "view" : method.equals("DELETE") ? "purge" : "restore"));
        // Actual preview/execute action is checked against the server-side preview type by FileOperationService.
        if (p.equals("/file-task-history")) return Set.of("settings.operations.view");
        if (p.startsWith("/file-operations")) return read && p.equals("/file-operations") ? Set.of("settings.operations.view")
            : Set.of("library.files", "library.trash", "settings.recycle.restore", "settings.recycle.purge");
        if (p.matches("/books/[^/]+/download")) return Set.of("library.download");
        if (p.startsWith("/knowledge")) return Set.of(read ? "knowledge.view" : "knowledge.generate");
        if (p.startsWith("/article-collections")) return Set.of(read
            ? (p.matches("/article-collections/[^/]+(?:/.*)?") ? "articles.collections.details.view" : "articles.collections.view")
            : "articles.collections.edit");
        if (p.equals("/articles/notes")) return Set.of("notes.articles.view");
        if (p.equals("/articles/knowledge")) return Set.of("articles.view");
        if (p.startsWith("/articles")) {
            if (p.matches("/articles/[^/]+/reading")) return Set.of("articles.read");
            if (!read && p.matches("/articles/[^/]+/knowledge")) return Set.of("articles.view");
            return Set.of(read ? (p.matches("/articles/[^/]+(?:/.*)?") ? "articles.read" : "articles.view") : "articles.edit");
        }
        if (p.startsWith("/booklists")) return Set.of(read
            ? (p.matches("/booklists/[^/]+(?:/.*)?") ? "booklists.details.view" : "booklists.view")
            : "booklists.edit");
        if (p.equals("/categories") || p.matches("/categories/[^/]+/books")) return Set.of(read ? "library.query" : "library.organize");
        if (p.startsWith("/categories") || p.matches("/books/[^/]+/categories")) return Set.of(read ? "library.view" : "library.organize");
        if (p.equals("/annotations/books") || p.matches("/annotations/books/[^/]+/export/[^/]+")) return Set.of("notes.books.view");
        if (p.startsWith("/annotations")) return read
            ? Set.of(hasBookId ? "reader.read" : "notes.view") : Set.of("reader.annotate");
        if (p.startsWith("/reading-posts")) return Set.of(read ? "notes.posts.view" : "notes.edit");
        if (p.startsWith("/book-reviews") || p.matches("/books/[^/]+/reviews")) return Set.of(read ? "notes.books.view" : "notes.edit");
        if (p.equals("/reading-overview") || p.startsWith("/reading-stats")) return Set.of("library.overview");
        if (p.startsWith("/reader-fonts")) return read ? Set.of("reader.read", "settings.fonts.view") : Set.of("settings.fonts.edit");
        if (p.matches("/(books|display-books)/[^/]+/(content|position|reading-time)")) return Set.of("reader.read");
        if (p.equals("/books") && read) return Set.of("library.query");
        if (p.equals("/books/revision")) return Set.of(read ? "library.query" : "library.edit");
        if (p.equals("/display-books") && read) return Set.of("library.query"); // Anonymous discovery bypasses role grants in RolePermissionFilter.
        if (p.matches("/display-books/[^/]+/(metadata|bibliography-source)")) return Set.of(read ? "library.details.view" : "library.edit");
        if (p.matches("/books/[^/]+/metadata")) return Set.of(read ? "library.details.view" : "library.edit");
        if (p.matches("/books/[^/]+") || p.matches("/display-books/[^/]+")) return Set.of(read ? "library.details.view" : "library.edit");
        if (p.startsWith("/display-books")) return Set.of(read ? "library.view" : "library.edit");
        if (p.startsWith("/books")) return Set.of(read ? "library.view" : "library.edit");
        return Set.of("roles.manage"); // Unknown future APIs are closed to delegated roles until explicitly classified.
    }

    private static boolean hasValidBookId(String queryString) {
        String value = null;
        for (String pair : queryString.split("&")) {
            String[] parts = pair.split("=", 2);
            if (!parts[0].equals("bookId")) continue;
            if (value != null) return false;
            try {
                value = java.net.URLDecoder.decode(parts.length == 2 ? parts[1] : "", java.nio.charset.StandardCharsets.UTF_8);
                java.util.UUID.fromString(value);
            } catch (IllegalArgumentException invalid) {
                return false;
            }
        }
        return value != null;
    }
}
