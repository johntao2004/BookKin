package io.github.johntao2004.bookkin.ingestion.upload;

import static io.github.johntao2004.bookkin.ingestion.upload.BookUploadModels.*;

import io.github.johntao2004.bookkin.catalog.BookFormat;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class BookUploadRepository {
    private static final String SELECT = """
            select u.*, r.name as root_name, u.detected_metadata::text as detected_text,
                   u.draft_metadata::text as draft_text, u.metadata_candidates::text as candidates_text
              from book_uploads u join library_roots r on r.id = u.library_root_id
            """;
    private final DSLContext dsl;
    private final ObjectMapper json;

    public BookUploadRepository(DSLContext dsl, ObjectMapper json) {
        this.dsl = dsl;
        this.json = json;
    }

    public UploadEntity create(UUID id, UUID actorId, UUID rootId, String filename, String stagingPath,
                               BookFormat format, long size, OffsetDateTime expiresAt) {
        dsl.execute("""
                insert into book_uploads(id, requested_by, library_root_id, original_filename, staging_path,
                  format, declared_size_bytes, status, expires_at) values (?, ?, ?, ?, ?, ?, ?, 'RECEIVING', cast(? as timestamptz))
                """, id, actorId, rootId, filename, stagingPath, format.name(), size, expiresAt);
        return findOwned(id, actorId).orElseThrow();
    }

    public Optional<UploadEntity> find(UUID id) {
        return dsl.fetchOptional(SELECT + " where u.id = ?", id).map(this::map);
    }

    public Optional<UploadEntity> findOwned(UUID id, UUID actorId) {
        return dsl.fetchOptional(SELECT + " where u.id = ? and u.requested_by = ?", id, actorId).map(this::map);
    }

    public List<UploadEntity> listOwned(UUID actorId) {
        return dsl.fetch(SELECT + " where u.requested_by = ? and u.created_at > now() - interval '7 days' order by u.created_at desc", actorId).map(this::map);
    }

    public void received(UUID id, long bytes, String fingerprint) {
        dsl.execute("""
                update book_uploads set received_bytes = ?, fingerprint = ?, status = 'INSPECTING',
                  error_code = null, error_detail = null, updated_at = now() where id = ? and status = 'RECEIVING'
                """, bytes, fingerprint, id);
    }

    public void processing(UUID id, BookUploadStatus status) {
        dsl.execute("update book_uploads set status = ?, updated_at = now() where id = ?", status.name(), id);
    }

    public void duplicate(UUID id, UUID bookId) {
        dsl.execute("update book_uploads set status = 'DUPLICATE', duplicate_book_id = ?, updated_at = now() where id = ?", bookId, id);
    }

    public void ready(UUID id, boolean encrypted, boolean drm, boolean signed, MetadataDraft detected,
                      MetadataDraft draft, List<MetadataCandidate> candidates, String coverCacheKey,
                      CoverSource coverSource, UUID[] similarBookIds) {
        dsl.execute("""
                update book_uploads set status = 'READY_FOR_REVIEW', encrypted = ?, drm_protected = ?,
                  digitally_signed = ?, detected_metadata = ?::jsonb, draft_metadata = ?::jsonb,
                  metadata_candidates = ?::jsonb, cover_cache_key = ?, selected_cover_source = ?,
                  similar_book_ids = ?, target_path = ?, updated_at = now() where id = ?
                """, encrypted, drm, signed, write(detected), write(draft), write(candidates), coverCacheKey,
                coverSource == null ? null : coverSource.name(), similarBookIds, draft.targetPath(), id);
    }

    public void updateDraft(UUID id, MetadataDraft draft) {
        dsl.execute("update book_uploads set draft_metadata = ?::jsonb, target_path = ?, updated_at = now() where id = ? and status = 'READY_FOR_REVIEW'",
                write(draft), draft.targetPath(), id);
    }

    public void selectCover(UUID id, CoverSource source, String relativePath) {
        dsl.execute("""
                update book_uploads set selected_cover_source = ?, selected_cover_staging_path = ?,
                  updated_at = now() where id = ? and status = 'READY_FOR_REVIEW'
                """, source.name(), relativePath, id);
    }

    @Transactional
    public UploadEntity beginCommit(UUID id, UUID actorId, String idempotencyKey) {
        var current = findOwned(id, actorId).orElseThrow();
        if (current.status() == BookUploadStatus.SUCCEEDED && idempotencyKey.equals(current.idempotencyKey())) return current;
        int changed = dsl.execute("""
                update book_uploads set status = 'COMMITTING', idempotency_key = ?, updated_at = now()
                 where id = ? and requested_by = ? and status = 'READY_FOR_REVIEW'
                   and (idempotency_key is null or idempotency_key = ?)
                """, idempotencyKey, id, actorId, idempotencyKey);
        if (changed != 1) throw new IllegalStateException("UPLOAD_NOT_READY");
        return findOwned(id, actorId).orElseThrow();
    }

    public void succeeded(UUID id, UUID bookId) {
        dsl.execute("""
                update book_uploads set status = 'SUCCEEDED', committed_book_id = ?, completed_at = now(),
                  error_code = null, error_detail = null, updated_at = now() where id = ?
                """, bookId, id);
    }

    public void failed(UUID id, String code, String detail) {
        dsl.execute("update book_uploads set status = 'FAILED', error_code = ?, error_detail = ?, updated_at = now() where id = ?", code, detail, id);
    }

    public void resetReady(UUID id, String code, String detail) {
        dsl.execute("update book_uploads set status = 'READY_FOR_REVIEW', error_code = ?, error_detail = ?, updated_at = now() where id = ?", code, detail, id);
    }

    public void cancelled(UUID id) {
        dsl.execute("update book_uploads set status = 'CANCELLED', completed_at = now(), updated_at = now() where id = ?", id);
    }

    public List<UploadEntity> expired() {
        return dsl.fetch(SELECT + " where u.expires_at < now() and u.status not in ('SUCCEEDED','CANCELLED','EXPIRED','COMMITTING') limit 100").map(this::map);
    }

    public void expired(UUID id) {
        dsl.execute("update book_uploads set status = 'EXPIRED', completed_at = now(), updated_at = now() where id = ?", id);
    }

    public String cached(String provider, String hash) {
        var record = dsl.fetchOne("select normalized_response::text from metadata_lookup_cache where provider = ? and query_hash = ? and expires_at > now()", provider, hash);
        return record == null ? null : record.get(0, String.class);
    }

    public void cache(String provider, String hash, String response, OffsetDateTime expiresAt) {
        dsl.execute("""
                insert into metadata_lookup_cache(provider, query_hash, normalized_response, expires_at)
                values (?, ?, ?::jsonb, cast(? as timestamptz)) on conflict (provider, query_hash) do update
                  set normalized_response = excluded.normalized_response, expires_at = excluded.expires_at, created_at = now()
                """, provider, hash, response, expiresAt);
    }

    private UploadEntity map(Record record) {
        UUID[] similar = record.get("similar_book_ids", UUID[].class);
        return new UploadEntity(record.get("id", UUID.class), record.get("requested_by", UUID.class),
                record.get("library_root_id", UUID.class), record.get("root_name", String.class),
                record.get("original_filename", String.class), record.get("staging_path", String.class),
                BookFormat.valueOf(record.get("format", String.class)), record.get("declared_size_bytes", Long.class),
                record.get("received_bytes", Long.class), record.get("fingerprint", String.class),
                BookUploadStatus.valueOf(record.get("status", String.class)), Boolean.TRUE.equals(record.get("encrypted", Boolean.class)),
                Boolean.TRUE.equals(record.get("drm_protected", Boolean.class)), Boolean.TRUE.equals(record.get("digitally_signed", Boolean.class)),
                read(record.get("detected_text", String.class), MetadataDraft.class),
                read(record.get("draft_text", String.class), MetadataDraft.class),
                readList(record.get("candidates_text", String.class)), record.get("cover_cache_key", String.class),
                enumValue(record.get("selected_cover_source", String.class)), record.get("selected_cover_staging_path", String.class),
                record.get("duplicate_book_id", UUID.class), similar == null ? List.of() : Arrays.asList(similar),
                record.get("target_path", String.class), record.get("error_code", String.class), record.get("error_detail", String.class),
                record.get("idempotency_key", String.class), record.get("committed_book_id", UUID.class),
                record.get("expires_at", OffsetDateTime.class), record.get("created_at", OffsetDateTime.class), record.get("updated_at", OffsetDateTime.class));
    }

    private String write(Object value) {
        try { return json.writeValueAsString(value); }
        catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    private <T> T read(String value, Class<T> type) {
        if (value == null) return null;
        try { return json.readValue(value, type); }
        catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    private List<MetadataCandidate> readList(String value) {
        if (value == null) return List.of();
        try { return json.readValue(value, new TypeReference<>() {}); }
        catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    private CoverSource enumValue(String value) { return value == null ? null : CoverSource.valueOf(value); }
}
