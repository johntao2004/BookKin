package io.github.johntao2004.bookkin.reading;

import io.github.johntao2004.bookkin.users.UserRepository;
import java.security.Principal;
import java.time.LocalDate;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/reading-stats")
public class ReadingStatsController {
    private final ReadingRepository reading;
    private final UserRepository users;

    public ReadingStatsController(ReadingRepository reading, UserRepository users) {
        this.reading = reading;
        this.users = users;
    }

    @GetMapping("/weekly")
    ReadingRepository.WeeklyReadingStats weekly(Principal principal) {
        var user = users.findByUsername(principal.getName()).orElseThrow();
        return reading.weeklyStats(user.id(), LocalDate.now());
    }
}
