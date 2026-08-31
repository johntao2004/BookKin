CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE app_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username varchar(80) NOT NULL,
    display_name varchar(120) NOT NULL,
    password_hash varchar(255) NOT NULL,
    role varchar(16) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
    status varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    must_change_password boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz,
    password_changed_at timestamptz
);
CREATE UNIQUE INDEX ux_app_users_username_lower ON app_users (lower(username));
CREATE UNIQUE INDEX ux_single_owner ON app_users ((role)) WHERE role = 'OWNER';

CREATE TABLE library_roots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(160) NOT NULL,
    configured_path text NOT NULL,
    canonical_path text,
    status varchar(16) NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE', 'READ_ONLY', 'OFFLINE')),
    can_read boolean NOT NULL DEFAULT false,
    can_write boolean NOT NULL DEFAULT false,
    can_atomic_move boolean NOT NULL DEFAULT false,
    can_stage boolean NOT NULL DEFAULT false,
    free_bytes bigint,
    last_capability_check_at timestamptz,
    last_scan_at timestamptz,
    scan_cursor text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_library_roots_name_lower ON library_roots (lower(name));
CREATE UNIQUE INDEX ux_library_roots_configured_path ON library_roots (configured_path);

CREATE TABLE series (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    sort_name text NOT NULL
);
CREATE UNIQUE INDEX ux_series_name_lower ON series (lower(name));
CREATE INDEX ix_series_name_trgm ON series USING gin (name gin_trgm_ops);

CREATE TABLE books (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    sort_title text NOT NULL,
    subtitle text,
    primary_author text NOT NULL DEFAULT '未知作者',
    description text,
    language varchar(32),
    publisher text,
    published_date varchar(40),
    isbn varchar(40),
    series_id uuid REFERENCES series(id),
    series_index numeric(10, 3),
    cover_cache_key text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_books_added_cursor ON books (created_at DESC, id DESC);
CREATE INDEX ix_books_title_cursor ON books (sort_title, id);
CREATE INDEX ix_books_author_cursor ON books (lower(primary_author), id);
CREATE INDEX ix_books_title_trgm ON books USING gin (title gin_trgm_ops);
CREATE INDEX ix_books_author_trgm ON books USING gin (primary_author gin_trgm_ops);
CREATE INDEX ix_books_series ON books (series_id, series_index);

CREATE TABLE authors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    sort_name text NOT NULL
);
CREATE INDEX ix_authors_name_trgm ON authors USING gin (name gin_trgm_ops);

CREATE TABLE book_authors (
    book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    author_id uuid NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    position smallint NOT NULL DEFAULT 0,
    PRIMARY KEY (book_id, author_id)
);

CREATE TABLE tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL
);
CREATE UNIQUE INDEX ux_tags_name_lower ON tags (lower(name));
CREATE INDEX ix_tags_name_trgm ON tags USING gin (name gin_trgm_ops);

CREATE TABLE book_tags (
    book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, tag_id)
);

CREATE TABLE book_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    library_root_id uuid NOT NULL REFERENCES library_roots(id),
    relative_path text NOT NULL,
    normalized_path text NOT NULL,
    format varchar(8) NOT NULL CHECK (format IN ('EPUB', 'PDF')),
    status varchar(16) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'OPERATING', 'TRASHED', 'MISSING', 'DELETED')),
    size_bytes bigint NOT NULL,
    modified_at timestamptz NOT NULL,
    fingerprint varchar(80) NOT NULL,
    quick_fingerprint varchar(120) NOT NULL,
    encrypted boolean NOT NULL DEFAULT false,
    drm_protected boolean NOT NULL DEFAULT false,
    digitally_signed boolean NOT NULL DEFAULT false,
    last_seen_scan_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (library_root_id, normalized_path)
);
CREATE INDEX ix_book_files_book ON book_files (book_id, status);
CREATE INDEX ix_book_files_scan ON book_files (library_root_id, last_seen_scan_id);
CREATE INDEX ix_book_files_fingerprint ON book_files (fingerprint);

CREATE TABLE reading_positions (
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    locator text NOT NULL,
    progress numeric(6, 5) NOT NULL CHECK (progress >= 0 AND progress <= 1),
    device_id varchar(120),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, book_id)
);

CREATE TABLE annotations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    annotation_type varchar(16) NOT NULL CHECK (annotation_type IN ('HIGHLIGHT', 'NOTE', 'BOOKMARK')),
    locator text NOT NULL,
    quote text,
    note text,
    color varchar(16),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_annotations_private_feed ON annotations (user_id, updated_at DESC, id DESC);
CREATE INDEX ix_annotations_user_book ON annotations (user_id, book_id, locator);

CREATE TABLE file_operation_previews (
    token uuid PRIMARY KEY,
    requested_by uuid NOT NULL REFERENCES app_users(id),
    operation_type varchar(24) NOT NULL,
    book_file_id uuid,
    recycle_bin_entry_id uuid,
    file_version_id uuid,
    source_root_id uuid REFERENCES library_roots(id),
    target_root_id uuid REFERENCES library_roots(id),
    source_path text NOT NULL,
    target_path text,
    expected_fingerprint varchar(80) NOT NULL,
    required_bytes bigint NOT NULL DEFAULT 0,
    conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
    warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
    request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_file_operation_previews_expiry ON file_operation_previews (expires_at);

CREATE TABLE file_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key varchar(160) NOT NULL,
    requested_by uuid NOT NULL REFERENCES app_users(id),
    preview_token uuid,
    operation_type varchar(24) NOT NULL CHECK (operation_type IN ('RENAME', 'MOVE', 'TRASH', 'RESTORE', 'WRITE_METADATA', 'PURGE')),
    status varchar(20) NOT NULL CHECK (status IN ('PLANNED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'ROLLED_BACK')),
    stage varchar(80) NOT NULL DEFAULT 'QUEUED',
    book_file_id uuid,
    recycle_bin_entry_id uuid,
    file_version_id uuid,
    source_root_id uuid REFERENCES library_roots(id),
    target_root_id uuid REFERENCES library_roots(id),
    source_path text NOT NULL,
    target_path text,
    expected_fingerprint varchar(80) NOT NULL,
    resulting_fingerprint varchar(80),
    request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_code varchar(80),
    error_detail text,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (requested_by, idempotency_key)
);
CREATE INDEX ix_file_operations_worker ON file_operations (status, created_at) WHERE status = 'PLANNED';
CREATE INDEX ix_file_operations_history ON file_operations (created_at DESC, id DESC);

CREATE TABLE file_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    book_file_id uuid NOT NULL,
    library_root_id uuid NOT NULL REFERENCES library_roots(id),
    version_path text NOT NULL,
    source_path text NOT NULL,
    fingerprint varchar(80) NOT NULL,
    size_bytes bigint NOT NULL,
    reason varchar(40) NOT NULL,
    created_by uuid NOT NULL REFERENCES app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    restored_at timestamptz
);
CREATE INDEX ix_file_versions_book ON file_versions (book_file_id, created_at DESC);
CREATE INDEX ix_file_versions_expiry ON file_versions (expires_at) WHERE restored_at IS NULL;

CREATE TABLE recycle_bin_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    book_file_id uuid NOT NULL,
    library_root_id uuid NOT NULL REFERENCES library_roots(id),
    original_path text NOT NULL,
    trash_path text NOT NULL,
    fingerprint varchar(80) NOT NULL,
    size_bytes bigint NOT NULL,
    deleted_by uuid NOT NULL REFERENCES app_users(id),
    deleted_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    restored_at timestamptz,
    purged_at timestamptz
);
CREATE INDEX ix_recycle_bin_active ON recycle_bin_entries (expires_at, id) WHERE restored_at IS NULL AND purged_at IS NULL;

CREATE TABLE file_leases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    book_file_id uuid NOT NULL,
    holder_id varchar(160) NOT NULL,
    lease_type varchar(16) NOT NULL CHECK (lease_type IN ('READ', 'WRITE')),
    acquired_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    UNIQUE (book_file_id, holder_id)
);
CREATE INDEX ix_file_leases_active ON file_leases (book_file_id, expires_at);

CREATE TABLE audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES app_users(id),
    event_type varchar(80) NOT NULL,
    subject_type varchar(80) NOT NULL,
    subject_id varchar(160),
    source_path text,
    target_path text,
    before_fingerprint varchar(80),
    after_fingerprint varchar(80),
    outcome varchar(24) NOT NULL,
    ip_address inet,
    user_agent text,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_events_time ON audit_events (occurred_at DESC, id DESC);
CREATE INDEX ix_audit_events_actor ON audit_events (actor_id, occurred_at DESC);

CREATE TABLE spring_session (
    primary_id char(36) NOT NULL,
    session_id char(36) NOT NULL,
    creation_time bigint NOT NULL,
    last_access_time bigint NOT NULL,
    max_inactive_interval integer NOT NULL,
    expiry_time bigint NOT NULL,
    principal_name varchar(100),
    CONSTRAINT spring_session_pk PRIMARY KEY (primary_id)
);
CREATE UNIQUE INDEX spring_session_ix1 ON spring_session (session_id);
CREATE INDEX spring_session_ix2 ON spring_session (expiry_time);
CREATE INDEX spring_session_ix3 ON spring_session (principal_name);

CREATE TABLE spring_session_attributes (
    session_primary_id char(36) NOT NULL,
    attribute_name varchar(200) NOT NULL,
    attribute_bytes bytea NOT NULL,
    CONSTRAINT spring_session_attributes_pk PRIMARY KEY (session_primary_id, attribute_name),
    CONSTRAINT spring_session_attributes_fk FOREIGN KEY (session_primary_id) REFERENCES spring_session(primary_id) ON DELETE CASCADE
);

CREATE TABLE batch_job_instance (
    job_instance_id bigint PRIMARY KEY,
    version bigint,
    job_name varchar(100) NOT NULL,
    job_key varchar(32) NOT NULL,
    CONSTRAINT job_inst_un UNIQUE (job_name, job_key)
);
CREATE TABLE batch_job_execution (
    job_execution_id bigint PRIMARY KEY,
    version bigint,
    job_instance_id bigint NOT NULL REFERENCES batch_job_instance(job_instance_id),
    create_time timestamp NOT NULL,
    start_time timestamp,
    end_time timestamp,
    status varchar(10),
    exit_code varchar(2500),
    exit_message varchar(2500),
    last_updated timestamp
);
CREATE TABLE batch_job_execution_params (
    job_execution_id bigint NOT NULL REFERENCES batch_job_execution(job_execution_id),
    parameter_name varchar(100) NOT NULL,
    parameter_type varchar(100) NOT NULL,
    parameter_value varchar(2500),
    identifying char(1) NOT NULL
);
CREATE TABLE batch_step_execution (
    step_execution_id bigint PRIMARY KEY,
    version bigint NOT NULL,
    step_name varchar(100) NOT NULL,
    job_execution_id bigint NOT NULL REFERENCES batch_job_execution(job_execution_id),
    create_time timestamp NOT NULL,
    start_time timestamp,
    end_time timestamp,
    status varchar(10),
    commit_count bigint,
    read_count bigint,
    filter_count bigint,
    write_count bigint,
    read_skip_count bigint,
    write_skip_count bigint,
    process_skip_count bigint,
    rollback_count bigint,
    exit_code varchar(2500),
    exit_message varchar(2500),
    last_updated timestamp
);
CREATE TABLE batch_step_execution_context (
    step_execution_id bigint PRIMARY KEY REFERENCES batch_step_execution(step_execution_id),
    short_context varchar(2500) NOT NULL,
    serialized_context text
);
CREATE TABLE batch_job_execution_context (
    job_execution_id bigint PRIMARY KEY REFERENCES batch_job_execution(job_execution_id),
    short_context varchar(2500) NOT NULL,
    serialized_context text
);
CREATE SEQUENCE batch_step_execution_seq MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE batch_job_execution_seq MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE batch_job_instance_seq MAXVALUE 9223372036854775807 NO CYCLE;
