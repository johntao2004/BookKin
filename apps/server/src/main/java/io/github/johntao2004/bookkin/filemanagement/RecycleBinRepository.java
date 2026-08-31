package io.github.johntao2004.bookkin.filemanagement;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

@Repository
public class RecycleBinRepository {
    private final DSLContext dsl;

    public RecycleBinRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public RecycleEntry create(UUID bookFileId, UUID rootId, String originalPath, String trashPath, String fingerprint,
                               long sizeBytes, UUID actorId, OffsetDateTime expiresAt) {
        UUID id = UUID.randomUUID();
        dsl.execute("""
                insert into recycle_bin_entries(id, book_file_id, library_root_id, original_path, trash_path,
                  fingerprint, size_bytes, deleted_by, expires_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?::timestamptz)
                """, id, bookFileId, rootId, originalPath, trashPath, fingerprint, sizeBytes, actorId, expiresAt);
        return find(id).orElseThrow();
    }

    public Optional<RecycleEntry> find(UUID id) {
        return dsl.fetchOptional("select * from recycle_bin_entries where id = ?", id).map(this::map);
    }

    public List<RecycleView> listActive() {
        return dsl.fetch("""
                select r.*, b.id as book_id, b.title as book_title, b.primary_author as book_author, b.updated_at as book_updated_at,
                       bf.format, u.display_name as deleted_by_name, lr.name as root_name
                  from recycle_bin_entries r
                  join book_files bf on bf.id = r.book_file_id
                  join books b on b.id = bf.book_id
                  join app_users u on u.id = r.deleted_by
                  join library_roots lr on lr.id = r.library_root_id
                 where r.restored_at is null and r.purged_at is null
                 order by r.deleted_at desc
                """).map(record -> new RecycleView(record.get("id", UUID.class), record.get("book_id", UUID.class),
                record.get("book_title", String.class), record.get("book_author", String.class), record.get("format", String.class),
                "/api/v1/books/" + record.get("book_id", UUID.class) + "/cover?v="
                        + record.get("book_updated_at", OffsetDateTime.class).toInstant().toEpochMilli(),
                record.get("root_name", String.class) + "/" + record.get("original_path", String.class),
                record.get("trash_path", String.class), record.get("size_bytes", Long.class),
                record.get("deleted_by_name", String.class), record.get("deleted_at", OffsetDateTime.class),
                record.get("expires_at", OffsetDateTime.class), record.get("fingerprint", String.class)));
    }

    public void markRestored(UUID id) {
        dsl.execute("update recycle_bin_entries set restored_at = now() where id = ?", id);
    }

    public void markPurged(UUID id) {
        dsl.execute("update recycle_bin_entries set purged_at = now() where id = ?", id);
    }

    public void delete(UUID id) {
        dsl.execute("delete from recycle_bin_entries where id = ?", id);
    }

    public List<RecycleEntry> findExpired(int limit) {
        return dsl.fetch("""
                select * from recycle_bin_entries where expires_at <= now() and restored_at is null and purged_at is null
                 order by expires_at limit ?
                """, limit).map(this::map);
    }

    private RecycleEntry map(Record record) {
        return new RecycleEntry(record.get("id", UUID.class), record.get("book_file_id", UUID.class),
                record.get("library_root_id", UUID.class), record.get("original_path", String.class),
                record.get("trash_path", String.class), record.get("fingerprint", String.class),
                record.get("size_bytes", Long.class), record.get("deleted_by", UUID.class),
                record.get("deleted_at", OffsetDateTime.class), record.get("expires_at", OffsetDateTime.class),
                record.get("restored_at", OffsetDateTime.class), record.get("purged_at", OffsetDateTime.class));
    }

    public record RecycleEntry(UUID id, UUID bookFileId, UUID libraryRootId, String originalPath, String trashPath,
                               String fingerprint, long sizeBytes, UUID deletedBy, OffsetDateTime deletedAt,
                               OffsetDateTime expiresAt, OffsetDateTime restoredAt, OffsetDateTime purgedAt) {
        public boolean active() { return restoredAt == null && purgedAt == null; }
    }
    public record RecycleView(UUID id, UUID bookId, String bookTitle, String bookAuthor, String format, String coverUrl,
                              String originalPath, String trashPath, long sizeBytes,
                              String deletedBy, OffsetDateTime deletedAt, OffsetDateTime expiresAt, String fingerprint) {}
}
