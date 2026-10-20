package com.elexvx.bookkin.web;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SpaForwardControllerTest {
    @ParameterizedTest
    @ValueSource(strings = {"/", "/recover", "/forgot-password", "/articles", "/articles/example", "/vault", "/profile", "/setup", "/login", "/change-password", "/library", "/library/all", "/library/uploads/example", "/library/books/example/edit",
            "/categories", "/categories/example", "/booklists", "/booklists/example", "/virtual-library", "/knowledge-graph",
            "/settings", "/settings/display-books", "/annotations", "/recycle-bin", "/reader/example",
            "/admin/users", "/admin/file-operations", "/admin/recycle-bin", "/admin/library-roots", "/admin/reader-fonts"})
    void directPageRequestsForwardToSpa(String path) throws Exception {
        MockMvcBuilders.standaloneSetup(new SpaForwardController()).build()
                .perform(get(path)).andExpect(status().isOk()).andExpect(forwardedUrl("/index.html"));
    }
}
