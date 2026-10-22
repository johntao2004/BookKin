package com.elexvx.bookkin.reading;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import com.elexvx.bookkin.catalog.BookRepository;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ReadingOverviewServiceTest {
    @Test void usesTheServersCalendarWeekWithAnExclusiveEndIncludingDstChange() {
        var reading = mock(ReadingRepository.class);
        var books = mock(BookRepository.class);
        var user = UUID.randomUUID();
        var clock = Clock.fixed(Instant.parse("2026-11-01T12:00:00Z"), ZoneId.of("America/New_York"));
        when(reading.weeklyStats(user, LocalDate.parse("2026-11-01"))).thenReturn(new ReadingRepository.WeeklyReadingStats(
                LocalDate.parse("2026-10-26"), LocalDate.parse("2026-11-01"), 0, 0, List.of()));
        when(books.recentlyReadIds(user)).thenReturn(List.of());
        var result = new ReadingOverviewService(reading, books, clock).current(user);
        assertThat(result.today()).isEqualTo(LocalDate.parse("2026-11-01"));
        assertThat(result.featuredBook()).isNull();
        assertThat(result.recentReading()).isEmpty();
        verify(books).newestAddedBetween(user, OffsetDateTime.parse("2026-10-26T00:00:00-04:00"), OffsetDateTime.parse("2026-11-02T00:00:00-05:00"));
    }

    @Test void preservesSavedPositionOrderingAndIncludesZeroProgressWithoutInventingAChapter() {
        var reading = mock(ReadingRepository.class);
        var books = mock(BookRepository.class);
        var user = UUID.randomUUID();
        var first = UUID.randomUUID();
        var second = UUID.randomUUID();
        var today = LocalDate.parse("2026-10-22");
        when(reading.weeklyStats(user, today)).thenReturn(new ReadingRepository.WeeklyReadingStats(today.minusDays(3), today.plusDays(3), 0, 0, List.of()));
        when(books.recentlyReadIds(user)).thenReturn(List.of(second, first));
        var summary = mock(BookRepository.BookSummary.class);
        when(books.findSummary(user, first)).thenReturn(Optional.of(summary));
        when(books.findSummary(user, second)).thenReturn(Optional.of(summary));
        for (var id : List.of(first, second)) when(reading.find(user, id)).thenReturn(Optional.of(
                new ReadingRepository.ReadingPosition(id, "pdf:page=12", BigDecimal.ZERO, "web", OffsetDateTime.parse("2026-10-22T09:00:00+08:00"))));
        var result = new ReadingOverviewService(reading, books, Clock.fixed(Instant.parse("2026-10-22T10:00:00Z"), ZoneId.of("Asia/Shanghai"))).current(user);
        assertThat(result.recentReading()).extracting(item -> item.position().bookId()).containsExactly(second, first);
        assertThat(result.recentReading().getFirst().position().progress()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.recentReading().getFirst().position().locator()).isEqualTo("pdf:page=12");
    }
}
