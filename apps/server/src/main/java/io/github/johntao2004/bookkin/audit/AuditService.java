package io.github.johntao2004.bookkin.audit;

import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
    private final DSLContext dsl;

    public AuditService(DSLContext dsl) {
        this.dsl = dsl;
    }

    public java.util.List<LoginEntry> loginEntries(int page, int size) {
        return dsl.fetch("select id, actor_id, subject_id, outcome, ip_address::text as ip, occurred_at from audit_events where event_type = 'LOGIN' order by occurred_at desc, id desc limit ? offset ?", size, (long) page * size)
            .map(row -> new LoginEntry(row.get("id", UUID.class), row.get("actor_id", UUID.class), row.get("subject_id", String.class), row.get("outcome", String.class), row.get("ip", String.class), row.get("occurred_at", java.time.OffsetDateTime.class)));
    }
    public long loginCount() { return dsl.fetchOne("select count(*) as total from audit_events where event_type = 'LOGIN'").get("total", Long.class); }
    public void recordLogin(UUID actorId, String subjectId, String outcome, String ip) {
        dsl.execute("insert into audit_events(actor_id,event_type,subject_type,subject_id,outcome,ip_address) values (?, 'LOGIN', 'USER', ?, ?, ?::inet)", actorId, subjectId, outcome, ip);
    }
    public record LoginEntry(UUID id, UUID actorId, String subjectId, String outcome, String ip, java.time.OffsetDateTime occurredAt) {}

    public void record(UUID actorId, String eventType, String subjectType, String subjectId, String sourcePath,
                       String targetPath, String beforeFingerprint, String afterFingerprint, String outcome, String detail) {
        dsl.execute("""
                insert into audit_events(actor_id, event_type, subject_type, subject_id, source_path, target_path,
                  before_fingerprint, after_fingerprint, outcome, detail)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                """, actorId, eventType, subjectType, subjectId, sourcePath, targetPath, beforeFingerprint,
                afterFingerprint, outcome, detail == null ? "{}" : detail);
    }
}
