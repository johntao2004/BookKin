package com.elexvx.bookkin.annotations;

import com.elexvx.bookkin.catalog.ReviewVisibility;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

/** Article posts are independent of book reviews and both annotation stores. */
@Repository
public class ArticlePostRepository {
    private final DSLContext db;
    public ArticlePostRepository(DSLContext db) { this.db = db; }

    public List<ArticlePost> mine(UUID userId, OffsetDateTime before, UUID beforeId, int limit) {
        return db.fetch("""
                select id,article_id,user_id,author_name,title,left(markdown,240) as markdown,
                       visibility,revision,created_at,updated_at from article_posts
                 where user_id=? and (?::timestamptz is null or (created_at,id) < (?::timestamptz,?::uuid))
                 order by created_at desc,id desc limit ?
                """, userId, before, before, beforeId, limit).map(this::map);
    }

    public Optional<ArticlePost> visible(UUID id, UUID userId) {
        return db.fetchOptional("select * from article_posts where id=? and (user_id=? or visibility='LIBRARY')", id, userId).map(this::map);
    }

    public ArticlePost create(UUID sourceId, UUID userId, String author, String title, String markdown, ReviewVisibility visibility) {
        return map(db.fetchOne("""
                insert into article_posts(id,article_id,user_id,author_name,title,markdown,visibility)
                values (?,?,?,?,?,?,?) returning *
                """, UUID.randomUUID(), sourceId, userId, author, title, markdown, visibility.name()));
    }

    public Optional<ArticlePost> update(UUID id, UUID userId, long revision, String title, String markdown, ReviewVisibility visibility) {
        return db.fetchOptional("""
                update article_posts set title=?,markdown=?,visibility=?,revision=revision+1,updated_at=now()
                 where id=? and user_id=? and revision=? returning *
                """, title, markdown, visibility.name(), id, userId, revision).map(this::map);
    }

    private ArticlePost map(Record row) {
        return new ArticlePost(row.get("id", UUID.class), row.get("article_id", UUID.class), row.get("user_id", UUID.class),
                row.get("author_name", String.class), row.get("title", String.class), row.get("markdown", String.class),
                ReviewVisibility.valueOf(row.get("visibility", String.class)), row.get("revision", Long.class),
                row.get("created_at", OffsetDateTime.class), row.get("updated_at", OffsetDateTime.class));
    }

    public record ArticlePost(UUID id, UUID sourceId, UUID userId, String authorName, String title, String markdown,
                              ReviewVisibility visibility, long revision, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
}
