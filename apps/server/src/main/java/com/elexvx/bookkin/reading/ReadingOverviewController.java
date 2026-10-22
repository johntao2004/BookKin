package com.elexvx.bookkin.reading;

import com.elexvx.bookkin.users.UserRepository;
import java.security.Principal;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
public class ReadingOverviewController {
    private final ReadingOverviewService overview;
    private final UserRepository users;

    public ReadingOverviewController(ReadingOverviewService overview, UserRepository users) {
        this.overview = overview;
        this.users = users;
    }

    @GetMapping("/api/v1/reading-overview")
    ReadingOverviewService.Overview current(Principal principal) {
        return overview.current(users.findByUsername(principal.getName()).orElseThrow().id());
    }
}
