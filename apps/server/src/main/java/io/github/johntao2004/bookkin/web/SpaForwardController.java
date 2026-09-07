package io.github.johntao2004.bookkin.web;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@Profile("api")
public class SpaForwardController {
    @GetMapping({"/", "/login", "/register", "/setup", "/change-password", "/library", "/recycle-bin", "/annotations",
            "/library/all", "/categories", "/booklists", "/virtual-library", "/settings", "/settings/display-books", "/display-books",
            "/admin/users", "/admin/file-operations", "/admin/recycle-bin", "/admin/library-roots", "/admin/reader-fonts"})
    String fixedRoutes() {
        return "forward:/index.html";
    }

    @GetMapping({"/library/uploads/{uploadId}", "/reader/{bookId}", "/categories/{categoryId}", "/booklists/{booklistId}"})
    String readerRoute() {
        return "forward:/index.html";
    }
}
