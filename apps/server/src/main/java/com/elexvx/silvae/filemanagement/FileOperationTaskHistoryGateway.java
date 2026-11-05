package com.elexvx.silvae.filemanagement;

import static com.elexvx.silvae.filemanagement.FileTaskHistoryModels.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

/** Explicit module gateway exposing only the fields needed by the combined history endpoint. */
@Repository
public class FileOperationTaskHistoryGateway {
    private final DSLContext dsl;

    public FileOperationTaskHistoryGateway(DSLContext dsl) { this.dsl = dsl; }

    public List<Entry> page(int limit, long offset) {
        return dsl.fetch("""
                select id, operation_type, status, source_path, stage, created_at, updated_at
                  from file_operations order by created_at desc, id desc limit ? offset ?
                """, limit, offset).map(row -> new Entry(row.get("id", UUID.class), "FILE_OPERATION",
                FileOperationType.valueOf(row.get("operation_type", String.class)),
                row.get("status", String.class), row.get("stage", String.class), title(row.get("source_path", String.class)),
                null, row.get("created_at", OffsetDateTime.class), row.get("updated_at", OffsetDateTime.class)));
    }

    public long count() { return dsl.fetchCount(dsl.selectFrom("file_operations")); }

    private static String title(String sourcePath) {
        if (sourcePath == null || sourcePath.isBlank()) return "文件任务";
        String name = sourcePath.substring(Math.max(sourcePath.lastIndexOf('/'), sourcePath.lastIndexOf('\\')) + 1);
        return name.replaceFirst("(?i)\\.(epub|pdf)$", "");
    }
}
