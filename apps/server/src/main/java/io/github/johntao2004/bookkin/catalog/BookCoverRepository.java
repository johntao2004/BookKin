package io.github.johntao2004.bookkin.catalog;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class BookCoverRepository {
    private final DSLContext dsl;
    public BookCoverRepository(DSLContext dsl) { this.dsl = dsl; }

    @Transactional
    public UUID activate(UUID bookId, UUID rootId, String relativePath, String fingerprint, int width, int height, UUID actorId) {
        var currentRecord = dsl.fetchOne("select cover_asset_id from books where id = ?", bookId);
        UUID current = currentRecord == null ? null : currentRecord.get(0, UUID.class);
        var existing = dsl.fetchOne("select id from book_cover_assets where library_root_id = ? and relative_path = ?", rootId, relativePath);
        UUID id = existing == null ? UUID.randomUUID() : existing.get("id", UUID.class);
        if (existing == null) {
            dsl.execute("""
                    insert into book_cover_assets(id, book_id, library_root_id, relative_path, fingerprint, mime_type,
                      width, height, source, created_by) values (?, ?, ?, ?, ?, 'image/jpeg', ?, ?, 'CUSTOM', ?)
                    """, id, bookId, rootId, relativePath, fingerprint, width, height, actorId);
        } else {
            dsl.execute("""
                    update book_cover_assets set book_id = ?, fingerprint = ?, mime_type = 'image/jpeg', width = ?,
                      height = ?, source = 'CUSTOM', created_by = ?, created_at = now(), retired_at = null, expires_at = null
                     where id = ?
                    """, bookId, fingerprint, width, height, actorId, id);
        }
        dsl.execute("update books set cover_asset_id = ?, updated_at = now() where id = ?", id, bookId);
        if (current != null && !current.equals(id)) dsl.execute("update book_cover_assets set retired_at = now(), expires_at = cast(? as timestamptz) where id = ?", OffsetDateTime.now().plusDays(30), current);
        return id;
    }

    @Transactional
    public void reset(UUID bookId) {
        var currentRecord = dsl.fetchOne("select cover_asset_id from books where id = ?", bookId);
        UUID current = currentRecord == null ? null : currentRecord.get(0, UUID.class);
        dsl.execute("update books set cover_asset_id = null, updated_at = now() where id = ?", bookId);
        if (current != null) dsl.execute("update book_cover_assets set retired_at = now(), expires_at = cast(? as timestamptz) where id = ?", OffsetDateTime.now().plusDays(30), current);
    }

    public List<ExpiredCoverAsset> findExpired(int limit) {
        return dsl.fetch("""
                select id, book_id, library_root_id, relative_path, fingerprint
                  from book_cover_assets
                 where retired_at is not null and expires_at < now()
                 order by expires_at
                 limit ?
                """, limit).map(record -> new ExpiredCoverAsset(
                record.get("id", UUID.class), record.get("book_id", UUID.class),
                record.get("library_root_id", UUID.class), record.get("relative_path", String.class),
                record.get("fingerprint", String.class)));
    }

    public void delete(UUID id) {
        dsl.execute("delete from book_cover_assets where id = ? and retired_at is not null and expires_at < now()", id);
    }

    public record ExpiredCoverAsset(UUID id, UUID bookId, UUID libraryRootId, String relativePath, String fingerprint) {}
}
