package com.elexvx.bookkin.ingestion.upload;

import static com.elexvx.bookkin.ingestion.upload.BookUploadModels.*;

import com.elexvx.bookkin.catalog.BookFormat;
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
// 保存上传状态机、草稿及候选缓存；暂存文件二进制不写入这些记录。
// Persists upload state, drafts and candidate cache without storing staged file binaries in these rows.
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
        return dsl.fetch(SELECT + " where u.requested_by = ? and (u.status = 'READY_FOR_REVIEW' or (u.status = 'ENRICHING' and u.expires_at > now()) or u.created_at > now() - interval '7 days') order by u.created_at desc", actorId).map(this::map);
    }

    public void received(UUID id, long bytes, String fingerprint) {
        dsl.execute("""
                update book_uploads set received_bytes = ?, fingerprint = ?, status = 'INSPECTING',
                  error_code = null, error_detail = null, updated_at = now() where id = ? and status = 'RECEIVING'
                """, bytes, fingerprint, id);
    }

    public boolean processing(UUID id, BookUploadStatus status) {
        if (status != BookUploadStatus.ENRICHING) throw new IllegalArgumentException("Only enrichment is a draft processing state");
        return dsl.execute("""
                update book_uploads set status = 'ENRICHING', expires_at = greatest(expires_at, now() + interval '24 hours'), updated_at = now()
                 where id = ? and status = 'READY_FOR_REVIEW'
                """, id) == 1;
    }

    public void duplicate(UUID id, UUID bookId) {
        dsl.execute("update book_uploads set status = 'DUPLICATE', duplicate_book_id = ?, updated_at = now() where id = ?", bookId, id);
    }

    public void ready(UUID id, boolean encrypted, boolean drm, boolean signed, MetadataDraft detected,
                      MetadataDraft draft, List<MetadataCandidate> candidates, String coverCacheKey,
                      CoverSource coverSource, UUID[] similarBookIds) {
        MetadataDraft safeDetected = withEmptyTitle(detected);
        MetadataDraft safeDraft = withEmptyTitle(draft);
        dsl.execute("""
                update book_uploads set status = 'READY_FOR_REVIEW', encrypted = ?, drm_protected = ?,
                  digitally_signed = ?, detected_metadata = ?::jsonb, draft_metadata = ?::jsonb,
                  metadata_candidates = ?::jsonb, cover_cache_key = ?, selected_cover_source = ?,
                  similar_book_ids = ?, target_path = ?, updated_at = now() where id = ? and status in ('INSPECTING','ENRICHING')
                """, encrypted, drm, signed, write(safeDetected), write(safeDraft), write(candidates), coverCacheKey,
                coverSource == null ? null : coverSource.name(), similarBookIds, safeDraft == null ? null : safeDraft.targetPath(), id);
    }

    public boolean updateDraft(UUID id, MetadataDraft draft) {
        return dsl.execute("update book_uploads set draft_metadata = ?::jsonb, target_path = ?, updated_at = now() where id = ? and status = 'READY_FOR_REVIEW'",
                write(draft), draft.targetPath(), id) == 1;
    }

    /** Completes an explicit candidate search without rewriting any draft metadata. */
    public boolean matchCompleted(UUID id, List<MetadataCandidate> candidates, String errorCode, String errorDetail) {
        return dsl.execute("""
                update book_uploads set status = 'READY_FOR_REVIEW', metadata_candidates = ?::jsonb,
                  error_code = ?, error_detail = ?, updated_at = now()
                 where id = ? and status = 'ENRICHING'
                """, write(candidates), errorCode, errorDetail, id) == 1;
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
        dsl.execute("update book_uploads set status = 'READY_FOR_REVIEW', error_code = ?, error_detail = ?, updated_at = now() where id = ? and status in ('ENRICHING','COMMITTING')", code, detail, id);
    }

    public boolean rollbackUnstartedCommit(UUID id, String idempotencyKey) {
        return dsl.execute("""
                update book_uploads set status = 'READY_FOR_REVIEW', idempotency_key = null,
                  error_code = null, error_detail = null, updated_at = now()
                 where id = ? and status = 'COMMITTING' and idempotency_key = ?
                """, id, idempotencyKey) == 1;
    }

    public void cancelled(UUID id) {
        dsl.execute("update book_uploads set status = 'CANCELLED', completed_at = now(), updated_at = now() where id = ?", id);
    }

    public List<UploadEntity> expired() {
        return dsl.fetch(SELECT + " where u.expires_at < now() and u.status not in ('SUCCEEDED','CANCELLED','EXPIRED','COMMITTING','READY_FOR_REVIEW') limit 100").map(this::map);
    }

    public boolean expired(UUID id) {
        return dsl.execute("""
                update book_uploads set status = 'EXPIRED', completed_at = now(), updated_at = now()
                 where id = ? and expires_at < now()
                   and status not in ('SUCCEEDED','CANCELLED','EXPIRED','COMMITTING','READY_FOR_REVIEW')
                """, id) == 1;
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
        MetadataDraft detected = withEmptyTitle(read(record.get("detected_text", String.class), MetadataDraft.class));
        MetadataDraft draft = withEmptyTitle(read(record.get("draft_text", String.class), MetadataDraft.class));
        return new UploadEntity(record.get("id", UUID.class), record.get("requested_by", UUID.class),
                record.get("library_root_id", UUID.class), record.get("root_name", String.class),
                record.get("original_filename", String.class), record.get("staging_path", String.class),
                BookFormat.valueOf(record.get("format", String.class)), record.get("declared_size_bytes", Long.class),
                record.get("received_bytes", Long.class), record.get("fingerprint", String.class),
                BookUploadStatus.valueOf(record.get("status", String.class)), Boolean.TRUE.equals(record.get("encrypted", Boolean.class)),
                Boolean.TRUE.equals(record.get("drm_protected", Boolean.class)), Boolean.TRUE.equals(record.get("digitally_signed", Boolean.class)),
                detected, draft,
                readList(record.get("candidates_text", String.class)), record.get("cover_cache_key", String.class),
                enumValue(record.get("selected_cover_source", String.class)), record.get("selected_cover_staging_path", String.class),
                record.get("duplicate_book_id", UUID.class), similar == null ? List.of() : Arrays.asList(similar),
                record.get("target_path", String.class), record.get("error_code", String.class), record.get("error_detail", String.class),
                record.get("idempotency_key", String.class), record.get("committed_book_id", UUID.class),
                record.get("expires_at", OffsetDateTime.class), record.get("created_at", OffsetDateTime.class), record.get("updated_at", OffsetDateTime.class));
    }

    private MetadataDraft withEmptyTitle(MetadataDraft draft) {
        if (draft == null || draft.title() != null) return draft;
        return new MetadataDraft("", draft.subtitle(), draft.authors(), draft.translators(), draft.language(), draft.publisher(),
                draft.publishedDate(), draft.isbn(), draft.description(), draft.series(), draft.seriesIndex(), draft.tags(),
                draft.pageCount(), draft.wordCount(), draft.sources(), draft.targetPath(), draft.publiclyVisible(),
                draft.subjectCodes(), draft.authorBiography(), draft.tableOfContents(), draft.knowledgeDraft(), draft.knowledgeTerms());
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
