package io.github.johntao2004.bookkin.filemanagement;

import io.github.johntao2004.bookkin.config.BookKinProperties;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.FileConflict;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.Operation;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.Preview;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class FileOperationRepository {
    private final DSLContext dsl;
    private final BookKinProperties properties;

    public FileOperationRepository(DSLContext dsl, BookKinProperties properties) {
        this.dsl = dsl;
        this.properties = properties;
    }

    public Preview savePreview(UUID actorId, FileOperationType type, UUID bookFileId, UUID sourceRootId, UUID targetRootId,
                               String sourcePath, String targetPath, String expectedFingerprint, long requiredBytes,
                               List<FileConflict> conflicts, List<String> warnings, UUID recycleBinEntryId,
                               UUID fileVersionId) {
        UUID token = UUID.randomUUID();
        OffsetDateTime expiresAt = OffsetDateTime.now().plus(properties.fileOperationPreviewTtl());
        dsl.execute("""
                insert into file_operation_previews(token, requested_by, operation_type, book_file_id,
                  recycle_bin_entry_id, file_version_id, source_root_id, target_root_id, source_path, target_path,
                  expected_fingerprint, required_bytes, conflicts, warnings, expires_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::timestamptz)
                """, token, actorId, type.name(), bookFileId, recycleBinEntryId, fileVersionId, sourceRootId,
                targetRootId, sourcePath, targetPath,
                expectedFingerprint, requiredBytes, conflictsJson(conflicts), stringsJson(warnings), expiresAt);
        return new Preview(token, type, sourcePath, targetPath, requiredBytes, expectedFingerprint, expiresAt, conflicts, warnings);
    }

    public Optional<PreviewRecord> findPreview(UUID token) {
        return dsl.fetchOptional("select * from file_operation_previews where token = ?", token).map(record -> new PreviewRecord(
                record.get("token", UUID.class), record.get("requested_by", UUID.class),
                FileOperationType.valueOf(record.get("operation_type", String.class)), record.get("book_file_id", UUID.class),
                record.get("recycle_bin_entry_id", UUID.class), record.get("file_version_id", UUID.class),
                record.get("source_root_id", UUID.class), record.get("target_root_id", UUID.class),
                record.get("source_path", String.class), record.get("target_path", String.class),
                record.get("expected_fingerprint", String.class), record.get("required_bytes", Long.class),
                record.get("conflicts", JSONB.class).data(), record.get("warnings", JSONB.class).data(),
                record.get("expires_at", OffsetDateTime.class)));
    }

    public Optional<Operation> findByIdempotency(UUID actorId, String key) {
        return dsl.fetchOptional("select * from file_operations where requested_by = ? and idempotency_key = ?", actorId, key).map(this::mapOperation);
    }

    public Optional<IdempotencyRecord> findIdempotency(UUID actorId, String key) {
        return dsl.fetchOptional("select * from file_operations where requested_by = ? and idempotency_key = ?", actorId, key)
                .map(record -> new IdempotencyRecord(mapOperation(record), record.get("preview_token", UUID.class),
                        record.get("expected_fingerprint", String.class),
                        FileOperationType.valueOf(record.get("operation_type", String.class)),
                        record.get("recycle_bin_entry_id", UUID.class), record.get("file_version_id", UUID.class)));
    }

    @Transactional
    public Operation create(UUID actorId, String idempotencyKey, PreviewRecord preview) {
        UUID id = UUID.randomUUID();
        dsl.execute("""
                insert into file_operations(id, idempotency_key, requested_by, preview_token, operation_type, status, book_file_id,
                  recycle_bin_entry_id, file_version_id, source_root_id, target_root_id, source_path, target_path,
                  expected_fingerprint)
                values (?, ?, ?, ?, ?, 'PLANNED', ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, idempotencyKey, actorId, preview.token(), preview.type().name(), preview.bookFileId(),
                preview.recycleBinEntryId(), preview.fileVersionId(), preview.sourceRootId(),
                preview.targetRootId(), preview.sourcePath(), preview.targetPath(), preview.expectedFingerprint());
        markFileOperating(preview.bookFileId());
        dsl.execute("delete from file_operation_previews where token = ?", preview.token());
        return find(id).orElseThrow();
    }

    @Transactional
    public Operation createDirect(UUID actorId, String idempotencyKey, FileOperationType type, UUID bookFileId,
                                  UUID recycleBinEntryId, UUID fileVersionId, UUID sourceRootId, UUID targetRootId,
                                  String sourcePath, String targetPath, String expectedFingerprint) {
        var existing = findByIdempotency(actorId, idempotencyKey);
        if (existing.isPresent()) return existing.get();
        UUID id = UUID.randomUUID();
        dsl.execute("""
                insert into file_operations(id, idempotency_key, requested_by, operation_type, status, book_file_id,
                  recycle_bin_entry_id, file_version_id, source_root_id, target_root_id, source_path, target_path, expected_fingerprint)
                values (?, ?, ?, ?, 'PLANNED', ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, idempotencyKey, actorId, type.name(), bookFileId, recycleBinEntryId, fileVersionId,
                sourceRootId, targetRootId, sourcePath, targetPath, expectedFingerprint);
        markFileOperating(bookFileId);
        return find(id).orElseThrow();
    }

    private void markFileOperating(UUID bookFileId) {
        if (bookFileId == null) return;
        int updated = dsl.execute("""
                update book_files set status = 'OPERATING', updated_at = now()
                 where id = ? and status in ('AVAILABLE', 'TRASHED')
                """, bookFileId);
        if (updated != 1) throw new BookFileBusyException(bookFileId);
    }

    public Optional<Operation> find(UUID id) {
        return dsl.fetchOptional("select * from file_operations where id = ?", id).map(this::mapOperation);
    }

    public List<Operation> list(int requestedLimit) {
        int limit = Math.max(1, Math.min(200, requestedLimit));
        return dsl.fetch("select * from file_operations order by created_at desc, id desc limit ?", limit).map(this::mapOperation);
    }

    @Transactional
    public Optional<ExecutionRecord> claimNext() {
        var record = dsl.fetchOptional("""
                select * from file_operations where status = 'PLANNED'
                 order by created_at, id for update skip locked limit 1
                """).orElse(null);
        if (record == null) return Optional.empty();
        UUID id = record.get("id", UUID.class);
        dsl.execute("update file_operations set status = 'RUNNING', stage = 'VALIDATING', started_at = now(), updated_at = now() where id = ?", id);
        return Optional.of(mapExecution(record));
    }

    public void updateStage(UUID id, String stage) {
        dsl.execute("update file_operations set stage = ?, updated_at = now() where id = ?", stage, id);
    }

    public void succeed(UUID id, String resultingFingerprint) {
        dsl.execute("""
                update file_operations set status = 'SUCCEEDED', stage = 'COMPLETE', resulting_fingerprint = ?,
                  completed_at = now(), updated_at = now() where id = ?
                """, resultingFingerprint, id);
    }

    public void fail(UUID id, String code, String detail) {
        dsl.execute("""
                update file_operations set status = 'FAILED', stage = 'FAILED', error_code = ?, error_detail = ?,
                  completed_at = now(), updated_at = now() where id = ?
                """, code, detail, id);
    }

    public void rolledBack(UUID id, String code, String detail) {
        dsl.execute("""
                update file_operations set status = 'ROLLED_BACK', stage = 'ROLLED_BACK', error_code = ?, error_detail = ?,
                  completed_at = now(), updated_at = now() where id = ?
                """, code, detail, id);
    }

    public void deleteExpiredPreviews() {
        dsl.execute("delete from file_operation_previews where expires_at <= now()");
    }

    private Operation mapOperation(Record record) {
        return new Operation(record.get("id", UUID.class), FileOperationType.valueOf(record.get("operation_type", String.class)),
                FileOperationStatus.valueOf(record.get("status", String.class)), record.get("source_path", String.class),
                record.get("target_path", String.class), record.get("created_at", OffsetDateTime.class),
                record.get("stage", String.class), record.get("error_code", String.class), record.get("error_detail", String.class));
    }

    private ExecutionRecord mapExecution(Record record) {
        return new ExecutionRecord(record.get("id", UUID.class), record.get("requested_by", UUID.class),
                FileOperationType.valueOf(record.get("operation_type", String.class)), record.get("book_file_id", UUID.class),
                record.get("recycle_bin_entry_id", UUID.class), record.get("file_version_id", UUID.class),
                record.get("source_root_id", UUID.class), record.get("target_root_id", UUID.class),
                record.get("source_path", String.class), record.get("target_path", String.class),
                record.get("expected_fingerprint", String.class));
    }

    private String conflictsJson(List<FileConflict> conflicts) {
        return "[" + conflicts.stream().map(value -> "{\"code\":\"" + escape(value.code()) + "\",\"message\":\"" + escape(value.message()) + "\",\"path\":\"" + escape(value.path()) + "\"}").reduce((a, b) -> a + "," + b).orElse("") + "]";
    }

    private String stringsJson(List<String> values) {
        return "[" + values.stream().map(value -> "\"" + escape(value) + "\"").reduce((a, b) -> a + "," + b).orElse("") + "]";
    }

    private String escape(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }

    public record PreviewRecord(UUID token, UUID requestedBy, FileOperationType type, UUID bookFileId,
                                UUID recycleBinEntryId, UUID fileVersionId, UUID sourceRootId, UUID targetRootId,
                                String sourcePath, String targetPath, String expectedFingerprint, long requiredBytes,
                                String conflictsJson, String warningsJson, OffsetDateTime expiresAt) {}
    public record ExecutionRecord(UUID id, UUID requestedBy, FileOperationType type, UUID bookFileId,
                                  UUID recycleBinEntryId, UUID fileVersionId, UUID sourceRootId, UUID targetRootId,
                                  String sourcePath, String targetPath, String expectedFingerprint) {}
    public record IdempotencyRecord(Operation operation, UUID previewToken, String expectedFingerprint,
                                    FileOperationType type, UUID recycleBinEntryId, UUID fileVersionId) {}

    public static final class BookFileBusyException extends RuntimeException {
        public BookFileBusyException(UUID bookFileId) {
            super("Book file is unavailable for a new operation: " + bookFileId);
        }
    }
}
