package io.github.johntao2004.bookkin.filemanagement;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

@Repository
public class FileVersionRepository {
    private final DSLContext dsl;

    public FileVersionRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public FileVersion create(UUID bookFileId, UUID rootId, String versionPath, String sourcePath, String fingerprint,
                              long sizeBytes, String reason, UUID actorId, OffsetDateTime expiresAt) {
        UUID id = UUID.randomUUID();
        dsl.execute("""
                insert into file_versions(id, book_file_id, library_root_id, version_path, source_path, fingerprint,
                  size_bytes, reason, created_by, expires_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::timestamptz)
                """, id, bookFileId, rootId, versionPath, sourcePath, fingerprint, sizeBytes, reason, actorId, expiresAt);
        return find(id).orElseThrow();
    }

    public Optional<FileVersion> find(UUID id) {
        return dsl.fetchOptional("select * from file_versions where id = ?", id).map(this::map);
    }

    public List<FileVersion> listForBook(UUID bookId) {
        return dsl.fetch("""
                select v.* from file_versions v join book_files bf on bf.id = v.book_file_id
                 where bf.book_id = ? order by v.created_at desc
                """, bookId).map(this::map);
    }

    public void markRestored(UUID id) {
        dsl.execute("update file_versions set restored_at = now() where id = ?", id);
    }

    public List<FileVersion> findExpired(int limit) {
        return dsl.fetch("select * from file_versions where expires_at <= now() order by expires_at limit ?", limit).map(this::map);
    }

    public void delete(UUID id) {
        dsl.execute("delete from file_versions where id = ?", id);
    }

    private FileVersion map(Record record) {
        return new FileVersion(record.get("id", UUID.class), record.get("book_file_id", UUID.class),
                record.get("library_root_id", UUID.class), record.get("version_path", String.class),
                record.get("source_path", String.class), record.get("fingerprint", String.class),
                record.get("size_bytes", Long.class), record.get("reason", String.class),
                record.get("created_by", UUID.class), record.get("created_at", OffsetDateTime.class),
                record.get("expires_at", OffsetDateTime.class), record.get("restored_at", OffsetDateTime.class));
    }

    public record FileVersion(UUID id, UUID bookFileId, UUID libraryRootId, String versionPath, String sourcePath,
                              String fingerprint, long sizeBytes, String reason, UUID createdBy,
                              OffsetDateTime createdAt, OffsetDateTime expiresAt, OffsetDateTime restoredAt) {}
}
