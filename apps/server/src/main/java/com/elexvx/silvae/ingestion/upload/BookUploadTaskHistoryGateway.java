package com.elexvx.silvae.ingestion.upload;

import com.elexvx.silvae.ingestion.upload.BookUploadTaskHistoryModels.UploadSummary;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

/** Explicit narrow module gateway for management history; never returns staging paths or private draft data. */
@Repository
public class BookUploadTaskHistoryGateway {
    private final DSLContext dsl;

    public BookUploadTaskHistoryGateway(DSLContext dsl) { this.dsl = dsl; }

    public List<UploadSummary> page(int limit, long offset) {
        return dsl.fetch("""
                select id, status, nullif(draft_metadata->>'title','') as title, original_filename, created_at, updated_at
                  from book_uploads order by created_at desc, id desc limit ? offset ?
                """, limit, offset).map(row -> new UploadSummary(row.get("id", UUID.class), row.get("status", String.class),
                row.get("title", String.class), row.get("original_filename", String.class),
                row.get("created_at", OffsetDateTime.class), row.get("updated_at", OffsetDateTime.class)));
    }

    public long count() { return dsl.fetchCount(dsl.selectFrom("book_uploads")); }
}
