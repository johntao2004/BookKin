ALTER TABLE security_settings ADD COLUMN session_max_minutes integer NOT NULL DEFAULT 1440
    CHECK (session_max_minutes BETWEEN 5 AND 43200);
CREATE TABLE session_revocation (
    session_primary_id char(36) PRIMARY KEY REFERENCES spring_session(primary_id) ON DELETE CASCADE,
    revoke_at bigint NOT NULL
);
