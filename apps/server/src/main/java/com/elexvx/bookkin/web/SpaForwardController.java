package com.elexvx.bookkin.web;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@Profile("api")
// 将显式前端路由转发至 SPA 壳；此转发不授予底层 API 权限。
// Forwards explicit frontend routes to the SPA shell without granting access to underlying APIs.
public class SpaForwardController {
    @GetMapping({"/", "/recover", "/forgot-password", "/articles", "/article-collections", "/vault", "/profile", "/login", "/register", "/setup", "/change-password", "/library", "/recycle-bin", "/annotations",
            "/annotations/books", "/annotations/articles", "/annotations/all", "/library/all", "/library/overview", "/search", "/categories", "/booklists", "/virtual-library", "/knowledge-graph", "/settings", "/settings/display-books", "/display-books",
            "/admin/users", "/admin/file-operations", "/admin/recycle-bin", "/admin/library-roots", "/admin/reader-fonts"})
    String fixedRoutes() {
        return "forward:/index.html";
    }

    @GetMapping({"/annotations/posts/{kind}/{postId}", "/articles/{articleId}", "/article-collections/{collectionId}", "/library/uploads/{uploadId}", "/library/books/{bookId}", "/library/books/{bookId}/edit", "/reader/{bookId}", "/categories/{categoryId}", "/booklists/{booklistId}"})
    String readerRoute() {
        return "forward:/index.html";
    }
}
