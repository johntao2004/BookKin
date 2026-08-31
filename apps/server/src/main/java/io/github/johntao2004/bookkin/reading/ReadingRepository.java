package io.github.johntao2004.bookkin.reading;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class ReadingRepository {
    private final DSLContext dsl;

    public ReadingRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<ReadingPosition> find(UUID userId, UUID bookId) {
        return dsl.fetchOptional("select * from reading_positions where user_id = ? and book_id = ?", userId, bookId)
                .map(record -> new ReadingPosition(bookId, record.get("locator", String.class),
                        record.get("progress", BigDecimal.class), record.get("device_id", String.class),
                        record.get("updated_at", OffsetDateTime.class)));
    }

    public ReadingPosition save(UUID userId, UUID bookId, String locator, BigDecimal progress, String deviceId) {
        dsl.execute("""
                insert into reading_positions(user_id, book_id, locator, progress, device_id)
                values (?, ?, ?, ?, ?)
                on conflict (user_id, book_id) do update set locator = excluded.locator, progress = excluded.progress,
                  device_id = excluded.device_id, updated_at = now()
                """, userId, bookId, locator, progress, deviceId);
        return find(userId, bookId).orElseThrow();
    }

    public void addReadingTime(UUID userId, UUID bookId, LocalDate readingDate, int seconds) {
        dsl.execute("""
                insert into reading_time_daily(user_id, book_id, reading_date, seconds)
                values (?, ?, ?, ?)
                on conflict (user_id, book_id, reading_date) do update
                  set seconds = least(86400, reading_time_daily.seconds + excluded.seconds), updated_at = now()
                """, userId, bookId, readingDate, seconds);
    }

    public WeeklyReadingStats weeklyStats(UUID userId, LocalDate today) {
        LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate weekEnd = weekStart.plusDays(6);
        LocalDate previousWeekStart = weekStart.minusWeeks(1);
        Map<LocalDate, Long> totals = dsl.fetch("""
                select reading_date, sum(seconds) as seconds
                  from reading_time_daily
                 where user_id = ? and reading_date between ? and ?
                 group by reading_date
                """, userId, previousWeekStart, weekEnd).stream().collect(Collectors.toMap(
                record -> record.get("reading_date", LocalDate.class),
                record -> record.get("seconds", Long.class)));
        List<DailyReadingTime> days = new ArrayList<>();
        long totalSeconds = 0;
        long previousWeekSeconds = 0;
        for (int index = 0; index < 7; index++) {
            LocalDate date = weekStart.plusDays(index);
            long seconds = totals.getOrDefault(date, 0L);
            totalSeconds += seconds;
            days.add(new DailyReadingTime(date, seconds));
            previousWeekSeconds += totals.getOrDefault(previousWeekStart.plusDays(index), 0L);
        }
        return new WeeklyReadingStats(weekStart, weekEnd, totalSeconds, previousWeekSeconds, days);
    }

    public record ReadingPosition(UUID bookId, String locator, BigDecimal progress, String deviceId, OffsetDateTime updatedAt) {}
    public record DailyReadingTime(LocalDate date, long seconds) {}
    public record WeeklyReadingStats(LocalDate weekStart, LocalDate weekEnd, long totalSeconds,
                                     long previousWeekSeconds, List<DailyReadingTime> days) {}
}
