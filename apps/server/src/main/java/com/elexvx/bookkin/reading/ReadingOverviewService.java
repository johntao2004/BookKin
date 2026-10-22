package com.elexvx.bookkin.reading;

import com.elexvx.bookkin.catalog.BookRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Private book overview; catalog queries cross modules only through the public book gateway. */
@Service
public class ReadingOverviewService {
    private final ReadingRepository reading;
    private final BookRepository books;
    private final Clock clock;

    @Autowired
    public ReadingOverviewService(ReadingRepository reading, BookRepository books) {
        this(reading, books, Clock.systemDefaultZone());
    }

    ReadingOverviewService(ReadingRepository reading, BookRepository books, Clock clock) {
        this.reading = reading;
        this.books = books;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Overview current(UUID userId) {
        var today = LocalDate.now(clock);
        var stats = reading.weeklyStats(userId, today);
        var start = stats.weekStart().atStartOfDay(clock.getZone()).toOffsetDateTime();
        var end = stats.weekEnd().plusDays(1).atStartOfDay(clock.getZone()).toOffsetDateTime();
        var featured = books.newestAddedBetween(userId, start, end).orElse(null);
        var recent = books.recentlyReadIds(userId).stream().flatMap(id ->
                books.findSummary(userId, id).stream().flatMap(book ->
                        reading.find(userId, id).stream().map(position -> new RecentReading(book, position)))).toList();
        return new Overview(today, featured, recent, stats);
    }

    public record RecentReading(BookRepository.BookSummary book, ReadingRepository.ReadingPosition position) {}
    public record Overview(LocalDate today, BookRepository.BookSummary featuredBook,
                           List<RecentReading> recentReading, ReadingRepository.WeeklyReadingStats stats) {}
}
