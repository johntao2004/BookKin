package io.github.johntao2004.bookkin.web;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@Profile("api")
public class SpaForwardController {
    @GetMapping({"/", "/login", "/setup", "/change-password", "/library", "/recycle-bin", "/annotations",
            "/admin/users", "/admin/file-operations", "/admin/recycle-bin"})
    String fixedRoutes() {
        return "forward:/index.html";
    }

    @GetMapping("/reader/{bookId}")
    String readerRoute() {
        return "forward:/index.html";
    }
}
