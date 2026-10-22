package com.elexvx.bookkin.catalog;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

@Repository
public class BookReviewRepository {
    private final DSLContext db;

    public BookReviewRepository(DSLContext db) {
        this.db = db;
    }

    public List<BookReview> findVisible(UUID bookId, UUID viewerId) {
        return db.fetch("""
                select id, book_id, user_id, author_name, title, markdown, visibility, revision, created_at, updated_at
                  from book_reviews
                 where book_id = ? and (user_id = ? or visibility = 'LIBRARY')
                 order by created_at desc, id desc
                """, bookId, viewerId).map(this::map);
    }

    public List<BookReview> findMine(UUID userId, OffsetDateTime before, UUID beforeId, int limit) {
        return db.fetch("""
                select id, book_id, user_id, author_name, title, left(markdown, 240) as markdown,
                       visibility, revision, created_at, updated_at
                  from book_reviews where user_id = ?
                   and (?::timestamptz is null or (created_at,id) < (?::timestamptz,?::uuid))
                 order by created_at desc, id desc limit ?
                """, userId, before, before, beforeId, limit).map(this::map);
    }

    public Optional<BookReview> findVisibleById(UUID id, UUID viewerId) {
        return db.fetchOptional("select * from book_reviews where id = ? and (user_id = ? or visibility = 'LIBRARY')",
                id, viewerId).map(this::map);
    }

    public BookReview create(UUID id, UUID bookId, UUID userId, String authorName,
                             String title, String markdown, ReviewVisibility visibility) {
        Record record = db.fetchOne("""
                insert into book_reviews(id, book_id, user_id, author_name, title, markdown, visibility)
                values (?, ?, ?, ?, ?, ?, ?)
                returning id, book_id, user_id, author_name, title, markdown, visibility, revision, created_at, updated_at
                """, id, bookId, userId, authorName, title, markdown, visibility.name());
        return map(record);
    }

    public Optional<BookReview> update(UUID id, UUID userId, long revision, String title,
                                       String markdown, ReviewVisibility visibility) {
        return db.fetchOptional("""
                update book_reviews
                   set title = ?, markdown = ?, visibility = ?, revision = revision + 1, updated_at = now()
                 where id = ? and user_id = ? and revision = ?
                returning id, book_id, user_id, author_name, title, markdown, visibility, revision, created_at, updated_at
                """, title, markdown, visibility.name(), id, userId, revision).map(this::map);
    }

    public boolean ownedBy(UUID id, UUID userId) {
        var row = db.fetchOne("select exists(select 1 from book_reviews where id = ? and user_id = ?)", id, userId);
        return row != null && Boolean.TRUE.equals(row.get(0, Boolean.class));
    }

    private BookReview map(Record row) {
        return new BookReview(row.get("id", UUID.class), row.get("book_id", UUID.class),
                row.get("user_id", UUID.class), row.get("author_name", String.class), row.get("title", String.class),
                row.get("markdown", String.class), ReviewVisibility.valueOf(row.get("visibility", String.class)),
                row.get("revision", Long.class), row.get("created_at", OffsetDateTime.class),
                row.get("updated_at", OffsetDateTime.class));
    }

    public record BookReview(UUID id, UUID bookId, UUID userId, String authorName, String title, String markdown,
                             ReviewVisibility visibility, long revision, OffsetDateTime createdAt,
                             OffsetDateTime updatedAt) {}
}
