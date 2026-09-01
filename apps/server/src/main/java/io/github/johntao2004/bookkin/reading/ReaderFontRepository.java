package io.github.johntao2004.bookkin.reading;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class ReaderFontRepository {
    private final DSLContext dsl;

    public ReaderFontRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<ReaderFont> findById(UUID id) {
        return dsl.fetchOptional("select * from reader_fonts where id = ?", id).map(this::map);
    }

    public Optional<ReaderFont> findEnabledById(UUID id) {
        return dsl.fetchOptional("select * from reader_fonts where id = ? and status = 'ENABLED' and content_path is not null", id).map(this::map);
    }

    public Optional<ReaderFont> findByFingerprint(String fingerprint) {
        return dsl.fetchOptional("select * from reader_fonts where fingerprint = ?", fingerprint).map(this::map);
    }

    public List<ReaderFont> findStagingBefore(OffsetDateTime cutoff) {
        return dsl.fetch("select * from reader_fonts where status = 'DISABLED' and content_path is null and fingerprint like 'pending:%' and created_at < ?::timestamptz", cutoff).map(this::map);
    }

    public List<ReaderFont> findAll(boolean includeDisabled) {
        String query = includeDisabled
                ? "select * from reader_fonts order by case status when 'ENABLED' then 0 else 1 end, created_at desc"
                : "select * from reader_fonts where status = 'ENABLED' and content_path is not null order by created_at desc";
        return dsl.fetch(query).map(this::map);
    }

    @Transactional
    public ReaderFont create(UUID id, String displayName, String familyName, String kind, String format,
                              String mimeType, long sizeBytes, String fingerprint, String stagingPath,
                              String licenseNote, UUID actorId) {
        dsl.execute("""
                insert into reader_fonts(id, display_name, family_name, font_kind, source, status, format,
                  mime_type, size_bytes, fingerprint, staging_path, license_note, uploaded_by)
                values (?, ?, ?, ?, 'CUSTOM', 'DISABLED', ?, ?, ?, ?, ?, ?, ?)
                """, id, displayName, familyName, kind, format, mimeType, sizeBytes, fingerprint,
                stagingPath, licenseNote, actorId);
        return findById(id).orElseThrow();
    }

    @Transactional
    public void received(UUID id, long sizeBytes, String fingerprint, String contentPath, String familyName) {
        dsl.execute("""
                update reader_fonts set size_bytes = ?, fingerprint = ?, content_path = ?, staging_path = null,
                  family_name = ?, status = 'ENABLED', updated_at = now() where id = ?
                """, sizeBytes, fingerprint, contentPath, familyName, id);
    }

    @Transactional
    public ReaderFont setStatus(UUID id, String status) {
        dsl.execute("update reader_fonts set status = ?, updated_at = now() where id = ?", status, id);
        return findById(id).orElseThrow();
    }

    @Transactional
    public void delete(UUID id) {
        dsl.execute("delete from reader_fonts where id = ? and status = 'DISABLED' and content_path is null", id);
    }

    private ReaderFont map(Record record) {
        return new ReaderFont(
                record.get("id", UUID.class),
                record.get("display_name", String.class),
                record.get("family_name", String.class),
                record.get("font_kind", String.class),
                record.get("source", String.class),
                record.get("status", String.class),
                record.get("format", String.class),
                record.get("mime_type", String.class),
                record.get("size_bytes", Long.class),
                record.get("fingerprint", String.class),
                record.get("staging_path", String.class),
                record.get("content_path", String.class),
                record.get("license_note", String.class),
                record.get("uploaded_by", UUID.class),
                record.get("created_at", OffsetDateTime.class),
                record.get("updated_at", OffsetDateTime.class));
    }

    public record ReaderFont(UUID id, String displayName, String familyName, String kind, String source,
                             String status, String format, String mimeType, Long sizeBytes, String fingerprint,
                             String stagingPath, String contentPath, String licenseNote, UUID uploadedBy,
                             OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
}
