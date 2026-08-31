package io.github.johntao2004.bookkin.catalog;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;

class BookRepositoryTest {
    @Test
    void updateFileLocationBindsModifiedAtAsTimestampWithTimeZone() {
        DSLContext dsl = mock(DSLContext.class);
        BookRepository repository = new BookRepository(dsl);
        UUID fileId = UUID.randomUUID();
        UUID rootId = UUID.randomUUID();
        OffsetDateTime modifiedAt = OffsetDateTime.parse("2026-08-21T22:00:00+08:00");

        repository.updateFileLocation(fileId, rootId, "author/book.epub", "author/book.epub",
                "sha256:test", 1024L, modifiedAt);

        verify(dsl).execute(argThat(sql -> sql.contains("modified_at = ?::timestamptz")),
                eq(rootId), eq("author/book.epub"), eq("author/book.epub"), eq("sha256:test"),
                eq(1024L), eq(modifiedAt), eq(fileId));
    }
}
