package com.elexvx.silvae.ingestion.upload;

import static org.assertj.core.api.Assertions.assertThat;
import com.elexvx.silvae.catalog.BookRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.jooq.tools.jdbc.MockConnection;
import org.jooq.tools.jdbc.MockResult;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class UploadPrecheckQueriesTest {
    @Test void draftLookupBindsOwnerHashAndSizeAndExcludesUnusableSessions() {
        List<String> sql = new ArrayList<>(); List<Object[]> bindings = new ArrayList<>();
        var db = DSL.using(new MockConnection(ctx -> {
            sql.add(ctx.sql()); bindings.add(ctx.bindings());
            return new MockResult[]{new MockResult(0, DSL.using(SQLDialect.POSTGRES).newResult(DSL.field("one",Integer.class)))};
        }), SQLDialect.POSTGRES);
        UUID actor = UUID.randomUUID();
        assertThat(new BookUploadRepository(db,new ObjectMapper()).hasOwnedPendingFingerprint(actor,"sha256:test",4)).isFalse();
        assertThat(bindings.getFirst()).containsExactly(actor,"sha256:test",4L);
        assertThat(sql.getFirst()).contains("requested_by = ?","fingerprint = ?","declared_size_bytes = ?", "received_bytes = declared_size_bytes", "status = 'READY_FOR_REVIEW'", "expires_at > now()");
        assertThat(new BookRepository(db).hasAvailableFingerprint("sha256:test",4)).isFalse();
        assertThat(sql.getLast()).contains("join book_files", "f.status = 'AVAILABLE'", "f.fingerprint = ?", "f.size_bytes = ?").doesNotContain("vault");
    }
}
