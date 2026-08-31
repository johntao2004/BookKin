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
