package com.elexvx.bookkin.reading;

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

// 阅读位置与时长以用户为边界；调用方必须从认证身份取得 userId。
// Reading positions/time are user-scoped; callers must derive userId from authenticated identity.
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

    // 同一用户同一本书采用最后写入位置；deviceId 是来源信息，不是版本冲突锁。
    // The last write wins for a user/book pair; deviceId records provenance, not a version-conflict lock.
    public ReadingPosition save(UUID userId, UUID bookId, String locator, BigDecimal progress, String deviceId) {
        dsl.execute("""
                insert into reading_positions(user_id, book_id, locator, progress, device_id)
                values (?, ?, ?, ?, ?)
                on conflict (user_id, book_id) do update set locator = excluded.locator, progress = excluded.progress,
                  device_id = excluded.device_id, updated_at = now()
                """, userId, bookId, locator, progress, deviceId);
        return find(userId, bookId).orElseThrow();
    }

    // 累加的是增量秒数；每日每本书上限一天，不是可安全重复提交的绝对计数。
    // Seconds are additive deltas capped at one day per book/day, not an absolute counter safe to replay.
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
