-- Consolidated BookKin schema. New installations are empty; legacy upgrades require ops/database.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';

CREATE FUNCTION bookkin_bump_catalog_revision() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'books' AND
           (to_jsonb(OLD) - 'updated_at') = (to_jsonb(NEW) - 'updated_at') THEN
            RETURN NULL;
        END IF;
        IF TG_TABLE_NAME = 'book_files' AND
           (to_jsonb(OLD) - ARRAY['updated_at', 'last_seen_scan_id', 'quick_fingerprint', 'modified_at', 'size_bytes']) =
           (to_jsonb(NEW) - ARRAY['updated_at', 'last_seen_scan_id', 'quick_fingerprint', 'modified_at', 'size_bytes']) THEN
            RETURN NULL;
        END IF;
        IF TG_TABLE_NAME = 'library_roots' THEN
            IF OLD.name = NEW.name THEN
                RETURN NULL;
            END IF;
        END IF;
    END IF;
    UPDATE catalog_state SET revision = revision + 1 WHERE id = 1;
    RETURN NULL;
END;
$$;

CREATE FUNCTION bookkin_claim_book_content() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.status = 'DELETED' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status <> 'DELETED' AND OLD.fingerprint = NEW.fingerprint AND OLD.book_id = NEW.book_id THEN
            RETURN NEW;
        END IF;
    END IF;

    INSERT INTO book_content_claims (fingerprint, book_id)
    VALUES (NEW.fingerprint, NEW.book_id)
    ON CONFLICT (fingerprint) DO UPDATE
       SET book_id = EXCLUDED.book_id, updated_at = now()
     WHERE book_content_claims.book_id = EXCLUDED.book_id
        OR NOT EXISTS (
            SELECT 1 FROM book_files
             WHERE fingerprint = EXCLUDED.fingerprint
               AND book_id <> EXCLUDED.book_id
               AND status <> 'DELETED'
        );
    IF NOT FOUND THEN
        RAISE unique_violation USING MESSAGE = 'DUPLICATE_FINGERPRINT',
            CONSTRAINT = 'book_content_claims_pkey';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TABLE ai_provider_settings (
    provider_id character varying(80) NOT NULL,
    label character varying(120) NOT NULL,
    provider_type character varying(32) NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    base_url character varying(500) DEFAULT ''::character varying NOT NULL,
    api_key_ciphertext text,
    model character varying(200) DEFAULT ''::character varying NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_provider_settings_provider_type_check CHECK (((provider_type)::text = ANY ((ARRAY['OPENAI_COMPATIBLE'::character varying, 'ANTHROPIC'::character varying, 'GEMINI'::character varying])::text[])))
);

CREATE TABLE ai_settings (
    id integer NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    auto_match boolean DEFAULT true NOT NULL,
    max_candidates integer DEFAULT 4 NOT NULL,
    timeout_seconds integer DEFAULT 20 NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_settings_id_check CHECK ((id = 1)),
    CONSTRAINT ai_settings_max_candidates_check CHECK (((max_candidates >= 1) AND (max_candidates <= 10))),
    CONSTRAINT ai_settings_timeout_seconds_check CHECK (((timeout_seconds >= 5) AND (timeout_seconds <= 120)))
);

CREATE TABLE annotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    book_id uuid NOT NULL,
    annotation_type character varying(16) NOT NULL,
    locator text NOT NULL,
    quote text,
    note text,
    color character varying(16),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    annotation_style character varying(16) DEFAULT 'HIGHLIGHT'::character varying NOT NULL,
    CONSTRAINT annotations_annotation_style_check CHECK (((annotation_style)::text = ANY ((ARRAY['HIGHLIGHT'::character varying, 'UNDERLINE'::character varying, 'BOLD'::character varying])::text[]))),
    CONSTRAINT annotations_annotation_type_check CHECK (((annotation_type)::text = ANY ((ARRAY['HIGHLIGHT'::character varying, 'NOTE'::character varying, 'BOOKMARK'::character varying])::text[])))
);

CREATE TABLE app_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(80) NOT NULL,
    display_name character varying(120) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(16) NOT NULL,
    status character varying(16) DEFAULT 'ACTIVE'::character varying NOT NULL,
    must_change_password boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone,
    password_changed_at timestamp with time zone,
    CONSTRAINT app_users_role_check CHECK (((role)::text = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MEMBER'::character varying])::text[]))),
    CONSTRAINT app_users_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'DISABLED'::character varying])::text[])))
);

CREATE TABLE article_asset_links (
    article_id uuid NOT NULL,
    asset_id uuid NOT NULL
);

CREATE TABLE article_assets (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    mime character varying(30) NOT NULL
);

CREATE TABLE article_collection_articles (
    collection_id uuid NOT NULL,
    article_id uuid NOT NULL,
    "position" integer NOT NULL,
    CONSTRAINT article_collection_articles_position_check CHECK (("position" >= 0))
);

CREATE TABLE article_collections (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    title character varying(240) NOT NULL,
    description character varying(4000) DEFAULT ''::character varying NOT NULL,
    visibility character varying(16) NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT article_collections_revision_check CHECK ((revision > 0)),
    CONSTRAINT article_collections_title_check CHECK (((char_length((title)::text) >= 1) AND (char_length((title)::text) <= 240))),
    CONSTRAINT article_collections_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['PRIVATE'::character varying, 'MEMBERS'::character varying])::text[])))
);

CREATE TABLE article_posts (
    id uuid NOT NULL,
    article_id uuid NOT NULL,
    user_id uuid NOT NULL,
    author_name character varying(120) NOT NULL,
    title character varying(200) NOT NULL,
    markdown text NOT NULL,
    visibility character varying(16) NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT article_posts_markdown_check CHECK (((char_length(markdown) <= 500000) AND (length(TRIM(BOTH FROM markdown)) > 0))),
    CONSTRAINT article_posts_revision_check CHECK ((revision > 0)),
    CONSTRAINT article_posts_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['PRIVATE'::character varying, 'LIBRARY'::character varying])::text[])))
);

CREATE TABLE article_reading (
    article_id uuid NOT NULL,
    user_id uuid NOT NULL,
    state jsonb DEFAULT '{}'::jsonb NOT NULL,
    revision bigint DEFAULT 0 NOT NULL
);

CREATE TABLE articles (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    title character varying(300) NOT NULL,
    author character varying(300) DEFAULT ''::character varying NOT NULL,
    source_url text DEFAULT ''::text NOT NULL,
    published_at character varying(100) DEFAULT ''::character varying NOT NULL,
    visibility character varying(16) NOT NULL,
    html text NOT NULL,
    tags character varying(1000) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    knowledge jsonb DEFAULT '[]'::jsonb NOT NULL,
    knowledge_revision uuid,
    cover_asset_id uuid,
    duplicate_source_key character varying(64),
    duplicate_content_key character varying(64),
    CONSTRAINT articles_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['PUBLIC'::character varying, 'PRIVATE'::character varying])::text[])))
);

CREATE TABLE audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    event_type character varying(80) NOT NULL,
    subject_type character varying(80) NOT NULL,
    subject_id character varying(160),
    source_path text,
    target_path text,
    before_fingerprint character varying(80),
    after_fingerprint character varying(80),
    outcome character varying(24) NOT NULL,
    ip_address inet,
    user_agent text,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE authors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_name text NOT NULL
);

CREATE TABLE batch_job_execution (
    job_execution_id bigint NOT NULL,
    version bigint,
    job_instance_id bigint NOT NULL,
    create_time timestamp without time zone NOT NULL,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    status character varying(10),
    exit_code character varying(2500),
    exit_message character varying(2500),
    last_updated timestamp without time zone
);

CREATE TABLE batch_job_execution_context (
    job_execution_id bigint NOT NULL,
    short_context character varying(2500) NOT NULL,
    serialized_context text
);

CREATE TABLE batch_job_execution_params (
    job_execution_id bigint NOT NULL,
    parameter_name character varying(100) NOT NULL,
    parameter_type character varying(100) NOT NULL,
    parameter_value character varying(2500),
    identifying character(1) NOT NULL
);

CREATE SEQUENCE batch_job_execution_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE batch_job_instance (
    job_instance_id bigint NOT NULL,
    version bigint,
    job_name character varying(100) NOT NULL,
    job_key character varying(32) NOT NULL
);

CREATE SEQUENCE batch_job_instance_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE batch_step_execution (
    step_execution_id bigint NOT NULL,
    version bigint NOT NULL,
    step_name character varying(100) NOT NULL,
    job_execution_id bigint NOT NULL,
    create_time timestamp without time zone NOT NULL,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    status character varying(10),
    commit_count bigint,
    read_count bigint,
    filter_count bigint,
    write_count bigint,
    read_skip_count bigint,
    write_skip_count bigint,
    process_skip_count bigint,
    rollback_count bigint,
    exit_code character varying(2500),
    exit_message character varying(2500),
    last_updated timestamp without time zone
);

CREATE TABLE batch_step_execution_context (
    step_execution_id bigint NOT NULL,
    short_context character varying(2500) NOT NULL,
    serialized_context text
);

CREATE SEQUENCE batch_step_execution_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE book_authors (
    book_id uuid NOT NULL,
    author_id uuid NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    contributor_role character varying(16) DEFAULT 'AUTHOR'::character varying NOT NULL,
    CONSTRAINT book_authors_contributor_role_check CHECK (((contributor_role)::text = ANY ((ARRAY['AUTHOR'::character varying, 'TRANSLATOR'::character varying])::text[])))
);

CREATE TABLE book_categories (
    book_id uuid NOT NULL,
    category_id uuid NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE book_content_claims (
    fingerprint character varying(80) NOT NULL,
    book_id uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE book_cover_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    book_id uuid NOT NULL,
    library_root_id uuid NOT NULL,
    relative_path text NOT NULL,
    fingerprint character varying(80) NOT NULL,
    mime_type character varying(80) NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    source character varying(24) NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    retired_at timestamp with time zone,
    expires_at timestamp with time zone,
    CONSTRAINT book_cover_assets_height_check CHECK ((height > 0)),
    CONSTRAINT book_cover_assets_source_check CHECK (((source)::text = ANY ((ARRAY['OPEN_LIBRARY'::character varying, 'GOOGLE_BOOKS'::character varying, 'CUSTOM'::character varying])::text[]))),
    CONSTRAINT book_cover_assets_width_check CHECK ((width > 0))
);

CREATE TABLE book_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    book_id uuid NOT NULL,
    library_root_id uuid NOT NULL,
    relative_path text NOT NULL,
    normalized_path text NOT NULL,
    format character varying(8) NOT NULL,
    status character varying(16) DEFAULT 'AVAILABLE'::character varying NOT NULL,
    size_bytes bigint NOT NULL,
    modified_at timestamp with time zone NOT NULL,
    fingerprint character varying(80) NOT NULL,
    quick_fingerprint character varying(120) NOT NULL,
    encrypted boolean DEFAULT false NOT NULL,
    drm_protected boolean DEFAULT false NOT NULL,
    digitally_signed boolean DEFAULT false NOT NULL,
    last_seen_scan_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    page_count integer,
    word_count bigint,
    CONSTRAINT book_files_format_check CHECK (((format)::text = ANY ((ARRAY['EPUB'::character varying, 'PDF'::character varying])::text[]))),
    CONSTRAINT book_files_status_check CHECK (((status)::text = ANY ((ARRAY['AVAILABLE'::character varying, 'OPERATING'::character varying, 'TRASHED'::character varying, 'MISSING'::character varying, 'DELETED'::character varying])::text[])))
);

CREATE TABLE book_knowledge (
    book_id uuid NOT NULL,
    file_id uuid NOT NULL,
    fingerprint text NOT NULL,
    status character varying(20) NOT NULL,
    operation_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    generated_at timestamp with time zone,
    provider_id text,
    sampled_sections integer DEFAULT 0 NOT NULL,
    total_sections integer DEFAULT 0 NOT NULL,
    points jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT book_knowledge_status_check CHECK (((status)::text = ANY ((ARRAY['GENERATING'::character varying, 'READY'::character varying, 'FAILED'::character varying])::text[])))
);

CREATE TABLE book_reviews (
    id uuid NOT NULL,
    book_id uuid NOT NULL,
    user_id uuid NOT NULL,
    author_name character varying(120) NOT NULL,
    title character varying(200) NOT NULL,
    markdown text NOT NULL,
    visibility character varying(16) NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT book_reviews_markdown_check CHECK (((char_length(markdown) <= 500000) AND (length(TRIM(BOTH FROM markdown)) > 0))),
    CONSTRAINT book_reviews_revision_check CHECK ((revision > 0)),
    CONSTRAINT book_reviews_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['PRIVATE'::character varying, 'LIBRARY'::character varying])::text[])))
);

CREATE TABLE book_tags (
    book_id uuid NOT NULL,
    tag_id uuid NOT NULL
);

CREATE TABLE book_uploads (
    id uuid NOT NULL,
    requested_by uuid NOT NULL,
    library_root_id uuid NOT NULL,
    original_filename text NOT NULL,
    staging_path text NOT NULL,
    format character varying(8) NOT NULL,
    declared_size_bytes bigint NOT NULL,
    received_bytes bigint DEFAULT 0 NOT NULL,
    fingerprint character varying(80),
    status character varying(32) NOT NULL,
    encrypted boolean DEFAULT false NOT NULL,
    drm_protected boolean DEFAULT false NOT NULL,
    digitally_signed boolean DEFAULT false NOT NULL,
    detected_metadata jsonb,
    draft_metadata jsonb,
    metadata_candidates jsonb DEFAULT '[]'::jsonb NOT NULL,
    cover_cache_key text,
    selected_cover_source character varying(24),
    selected_cover_staging_path text,
    duplicate_book_id uuid,
    similar_book_ids uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
    target_path text,
    error_code character varying(80),
    error_detail text,
    idempotency_key character varying(160),
    committed_book_id uuid,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT book_uploads_declared_size_bytes_check CHECK ((declared_size_bytes >= 0)),
    CONSTRAINT book_uploads_format_check CHECK (((format)::text = ANY ((ARRAY['EPUB'::character varying, 'PDF'::character varying])::text[]))),
    CONSTRAINT book_uploads_status_check CHECK (((status)::text = ANY ((ARRAY['RECEIVING'::character varying, 'INSPECTING'::character varying, 'ENRICHING'::character varying, 'READY_FOR_REVIEW'::character varying, 'COMMITTING'::character varying, 'SUCCEEDED'::character varying, 'DUPLICATE'::character varying, 'FAILED'::character varying, 'CANCELLED'::character varying, 'EXPIRED'::character varying])::text[])))
);

CREATE TABLE booklist_entries (
    booklist_id uuid NOT NULL,
    book_id uuid NOT NULL,
    sort_order bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE booklists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    kind character varying(16) NOT NULL,
    visibility character varying(16) NOT NULL,
    title character varying(240) NOT NULL,
    description text,
    sort_order bigint NOT NULL,
    revision bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booklists_kind_check CHECK (((kind)::text = ANY ((ARRAY['OFFICIAL'::character varying, 'PERSONAL'::character varying])::text[]))),
    CONSTRAINT booklists_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['PRIVATE'::character varying, 'MEMBERS'::character varying, 'PUBLIC'::character varying])::text[])))
);

CREATE TABLE books (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    sort_title text NOT NULL,
    subtitle text,
    primary_author text DEFAULT '未知作者'::text NOT NULL,
    description text,
    language character varying(32),
    publisher text,
    published_date character varying(40),
    isbn character varying(40),
    series_id uuid,
    series_index numeric(10,3),
    cover_cache_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata_sources jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata_overrides text[] DEFAULT ARRAY[]::text[] NOT NULL,
    cover_asset_id uuid,
    subject_codes text[] DEFAULT ARRAY[]::text[] NOT NULL,
    author_biography text,
    table_of_contents text
);

CREATE TABLE catalog_duplicate_candidates (
    library_root_id uuid NOT NULL,
    normalized_path text NOT NULL,
    relative_path text NOT NULL,
    quick_fingerprint character varying(120) NOT NULL,
    fingerprint character varying(80) NOT NULL,
    existing_book_id uuid,
    last_seen_scan_id uuid NOT NULL,
    detected_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE catalog_state (
    id smallint NOT NULL,
    revision bigint DEFAULT 0 NOT NULL,
    CONSTRAINT catalog_state_id_check CHECK ((id = 1))
);

CREATE TABLE categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(160) NOT NULL,
    description text,
    sort_order bigint NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE content_storage_scans (
    kind character varying(16) NOT NULL,
    path_hash character varying(64) NOT NULL,
    last_scan_at timestamp with time zone NOT NULL,
    CONSTRAINT content_storage_scans_kind_check CHECK (((kind)::text = ANY ((ARRAY['ARTICLES'::character varying, 'VAULT'::character varying])::text[])))
);

CREATE TABLE display_catalog (
    id smallint NOT NULL,
    revision bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT display_catalog_id_check CHECK ((id = 1))
);

CREATE TABLE display_catalog_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    catalog_id smallint NOT NULL,
    book_id uuid NOT NULL,
    sort_order bigint NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE file_leases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    book_file_id uuid NOT NULL,
    holder_id character varying(160) NOT NULL,
    lease_type character varying(16) NOT NULL,
    acquired_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT file_leases_lease_type_check CHECK (((lease_type)::text = ANY ((ARRAY['READ'::character varying, 'WRITE'::character varying])::text[])))
);

CREATE TABLE file_operation_previews (
    token uuid NOT NULL,
    requested_by uuid NOT NULL,
    operation_type character varying(24) NOT NULL,
    book_file_id uuid,
    recycle_bin_entry_id uuid,
    file_version_id uuid,
    source_root_id uuid,
    target_root_id uuid,
    source_path text NOT NULL,
    target_path text,
    expected_fingerprint character varying(80) NOT NULL,
    required_bytes bigint DEFAULT 0 NOT NULL,
    conflicts jsonb DEFAULT '[]'::jsonb NOT NULL,
    warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    request_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE file_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    idempotency_key character varying(160) NOT NULL,
    requested_by uuid NOT NULL,
    preview_token uuid,
    operation_type character varying(24) NOT NULL,
    status character varying(20) NOT NULL,
    stage character varying(80) DEFAULT 'QUEUED'::character varying NOT NULL,
    book_file_id uuid,
    recycle_bin_entry_id uuid,
    file_version_id uuid,
    source_root_id uuid,
    target_root_id uuid,
    source_path text NOT NULL,
    target_path text,
    expected_fingerprint character varying(80) NOT NULL,
    resulting_fingerprint character varying(80),
    request_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_code character varying(80),
    error_detail text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT file_operations_operation_type_check CHECK (((operation_type)::text = ANY ((ARRAY['RENAME'::character varying, 'MOVE'::character varying, 'TRASH'::character varying, 'RESTORE'::character varying, 'WRITE_METADATA'::character varying, 'PURGE'::character varying])::text[]))),
    CONSTRAINT file_operations_status_check CHECK (((status)::text = ANY ((ARRAY['PLANNED'::character varying, 'RUNNING'::character varying, 'SUCCEEDED'::character varying, 'FAILED'::character varying, 'ROLLED_BACK'::character varying])::text[])))
);

CREATE TABLE file_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    book_file_id uuid NOT NULL,
    library_root_id uuid NOT NULL,
    version_path text NOT NULL,
    source_path text NOT NULL,
    fingerprint character varying(80) NOT NULL,
    size_bytes bigint NOT NULL,
    reason character varying(40) NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    restored_at timestamp with time zone
);

CREATE TABLE library_roots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(160) NOT NULL,
    configured_path text NOT NULL,
    canonical_path text,
    status character varying(16) DEFAULT 'OFFLINE'::character varying NOT NULL,
    can_read boolean DEFAULT false NOT NULL,
    can_write boolean DEFAULT false NOT NULL,
    can_atomic_move boolean DEFAULT false NOT NULL,
    can_stage boolean DEFAULT false NOT NULL,
    free_bytes bigint,
    last_capability_check_at timestamp with time zone,
    last_scan_at timestamp with time zone,
    scan_cursor text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT library_roots_status_check CHECK (((status)::text = ANY ((ARRAY['ONLINE'::character varying, 'READ_ONLY'::character varying, 'OFFLINE'::character varying])::text[])))
);

CREATE TABLE mail_settings (
    id integer NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    host character varying(253) NOT NULL,
    port integer NOT NULL,
    security character varying(16) NOT NULL,
    username character varying(320) DEFAULT ''::character varying NOT NULL,
    password_ciphertext text,
    sender character varying(320) NOT NULL,
    public_url character varying(1000) NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_settings_id_check CHECK ((id = 1)),
    CONSTRAINT mail_settings_port_check CHECK (((port >= 1) AND (port <= 65535))),
    CONSTRAINT mail_settings_security_check CHECK (((security)::text = ANY ((ARRAY['STARTTLS'::character varying, 'TLS'::character varying, 'LOCAL'::character varying])::text[])))
);

CREATE TABLE metadata_lookup_cache (
    provider character varying(32) NOT NULL,
    query_hash character varying(80) NOT NULL,
    normalized_response jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE password_policy (
    id integer NOT NULL,
    min_length integer NOT NULL,
    require_uppercase boolean NOT NULL,
    require_lowercase boolean NOT NULL,
    require_digit boolean NOT NULL,
    require_special boolean NOT NULL,
    CONSTRAINT password_policy_id_check CHECK ((id = 1)),
    CONSTRAINT password_policy_min_length_check CHECK (((min_length >= 8) AND (min_length <= 128)))
);

CREATE TABLE personal_vault (
    user_id uuid NOT NULL,
    envelope jsonb NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    access_key_ciphertext text
);

CREATE TABLE reader_fonts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_name character varying(160) NOT NULL,
    family_name character varying(160) NOT NULL,
    font_kind character varying(16) NOT NULL,
    source character varying(16) NOT NULL,
    status character varying(16) DEFAULT 'DISABLED'::character varying NOT NULL,
    format character varying(8) NOT NULL,
    mime_type character varying(120) NOT NULL,
    size_bytes bigint NOT NULL,
    fingerprint character varying(80) NOT NULL,
    staging_path text,
    content_path text,
    license_note text,
    uploaded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reader_fonts_font_kind_check CHECK (((font_kind)::text = ANY ((ARRAY['SERIF'::character varying, 'SANS'::character varying])::text[]))),
    CONSTRAINT reader_fonts_format_check CHECK (((format)::text = ANY ((ARRAY['WOFF2'::character varying, 'WOFF'::character varying, 'TTF'::character varying, 'OTF'::character varying])::text[]))),
    CONSTRAINT reader_fonts_size_bytes_check CHECK ((size_bytes > 0)),
    CONSTRAINT reader_fonts_source_check CHECK (((source)::text = 'CUSTOM'::text)),
    CONSTRAINT reader_fonts_status_check CHECK (((status)::text = ANY ((ARRAY['ENABLED'::character varying, 'DISABLED'::character varying])::text[])))
);

CREATE TABLE reading_positions (
    user_id uuid NOT NULL,
    book_id uuid NOT NULL,
    locator text NOT NULL,
    progress numeric(6,5) NOT NULL,
    device_id character varying(120),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reading_positions_progress_check CHECK (((progress >= (0)::numeric) AND (progress <= (1)::numeric)))
);

CREATE TABLE reading_time_daily (
    user_id uuid NOT NULL,
    book_id uuid NOT NULL,
    reading_date date NOT NULL,
    seconds integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reading_time_daily_seconds_check CHECK (((seconds >= 0) AND (seconds <= 86400)))
);

CREATE TABLE recovery_mailboxes (
    user_id uuid NOT NULL,
    email character varying(320) NOT NULL
);

CREATE TABLE recovery_tokens (
    token_hash character varying(64) NOT NULL,
    user_id uuid NOT NULL,
    purpose character varying(10) NOT NULL,
    email character varying(320) NOT NULL,
    password_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT recovery_tokens_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['BIND'::character varying, 'RESET'::character varying])::text[])))
);

CREATE TABLE recycle_bin_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    book_file_id uuid NOT NULL,
    library_root_id uuid NOT NULL,
    original_path text NOT NULL,
    trash_path text NOT NULL,
    fingerprint character varying(80) NOT NULL,
    size_bytes bigint NOT NULL,
    deleted_by uuid NOT NULL,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    restored_at timestamp with time zone,
    purged_at timestamp with time zone
);

CREATE TABLE role_permission_policy (
    id integer NOT NULL,
    revision bigint DEFAULT 0 NOT NULL,
    grants jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT role_permission_policy_id_check CHECK ((id = 1))
);

CREATE TABLE security_settings (
    id integer NOT NULL,
    registration_enabled boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    session_max_minutes integer DEFAULT 1440 NOT NULL,
    CONSTRAINT security_settings_id_check CHECK ((id = 1)),
    CONSTRAINT security_settings_session_max_minutes_check CHECK (((session_max_minutes >= 5) AND (session_max_minutes <= 43200)))
);

CREATE TABLE series (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_name text NOT NULL
);

CREATE TABLE session_revocation (
    session_primary_id character(36) NOT NULL,
    revoke_at bigint NOT NULL
);

CREATE TABLE site_settings (
    id integer NOT NULL,
    settings jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT site_settings_id_check CHECK ((id = 1))
);

CREATE TABLE spring_session (
    primary_id character(36) NOT NULL,
    session_id character(36) NOT NULL,
    creation_time bigint NOT NULL,
    last_access_time bigint NOT NULL,
    max_inactive_interval integer NOT NULL,
    expiry_time bigint NOT NULL,
    principal_name character varying(100)
);

CREATE TABLE spring_session_attributes (
    session_primary_id character(36) NOT NULL,
    attribute_name character varying(200) NOT NULL,
    attribute_bytes bytea NOT NULL
);

CREATE TABLE tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL
);

CREATE TABLE two_factor_credentials (
    user_id uuid NOT NULL,
    secret_ciphertext text,
    credential_version uuid NOT NULL,
    pending_ciphertext text,
    pending_id uuid,
    pending_expires_at timestamp with time zone,
    last_step bigint DEFAULT '-1'::integer NOT NULL,
    attempt_window timestamp with time zone DEFAULT now() NOT NULL,
    attempts integer DEFAULT 0 NOT NULL
);

CREATE TABLE two_factor_recovery_codes (
    user_id uuid NOT NULL,
    code_hash character varying(64) NOT NULL
);

CREATE TABLE vault_chunks (
    user_id uuid NOT NULL,
    object_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    storage_id uuid NOT NULL,
    digest character varying(64) NOT NULL,
    CONSTRAINT vault_chunks_chunk_index_check CHECK (((chunk_index >= 0) AND (chunk_index <= 1023)))
);

CREATE TABLE vault_objects (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    manifest text NOT NULL,
    state text NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    chunk_count integer DEFAULT 0 NOT NULL
);

CREATE TABLE vault_policy (
    id integer NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    revision bigint DEFAULT 0 NOT NULL,
    CONSTRAINT vault_policy_id_check CHECK ((id = 1))
);

ALTER TABLE ONLY ai_provider_settings
    ADD CONSTRAINT ai_provider_settings_pkey PRIMARY KEY (provider_id);

ALTER TABLE ONLY ai_settings
    ADD CONSTRAINT ai_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY annotations
    ADD CONSTRAINT annotations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY article_asset_links
    ADD CONSTRAINT article_asset_links_pkey PRIMARY KEY (article_id, asset_id);

ALTER TABLE ONLY article_assets
    ADD CONSTRAINT article_assets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY article_collection_articles
    ADD CONSTRAINT article_collection_articles_collection_id_position_key UNIQUE (collection_id, "position");

ALTER TABLE ONLY article_collection_articles
    ADD CONSTRAINT article_collection_articles_pkey PRIMARY KEY (collection_id, article_id);

ALTER TABLE ONLY article_collections
    ADD CONSTRAINT article_collections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY article_posts
    ADD CONSTRAINT article_posts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY article_reading
    ADD CONSTRAINT article_reading_pkey PRIMARY KEY (article_id, user_id);

ALTER TABLE ONLY articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY authors
    ADD CONSTRAINT authors_pkey PRIMARY KEY (id);

ALTER TABLE ONLY batch_job_execution_context
    ADD CONSTRAINT batch_job_execution_context_pkey PRIMARY KEY (job_execution_id);

ALTER TABLE ONLY batch_job_execution
    ADD CONSTRAINT batch_job_execution_pkey PRIMARY KEY (job_execution_id);

ALTER TABLE ONLY batch_job_instance
    ADD CONSTRAINT batch_job_instance_pkey PRIMARY KEY (job_instance_id);

ALTER TABLE ONLY batch_step_execution_context
    ADD CONSTRAINT batch_step_execution_context_pkey PRIMARY KEY (step_execution_id);

ALTER TABLE ONLY batch_step_execution
    ADD CONSTRAINT batch_step_execution_pkey PRIMARY KEY (step_execution_id);

ALTER TABLE ONLY book_authors
    ADD CONSTRAINT book_authors_pkey PRIMARY KEY (book_id, author_id, contributor_role);

ALTER TABLE ONLY book_categories
    ADD CONSTRAINT book_categories_pkey PRIMARY KEY (book_id, category_id);

ALTER TABLE ONLY book_content_claims
    ADD CONSTRAINT book_content_claims_pkey PRIMARY KEY (fingerprint);

ALTER TABLE ONLY book_cover_assets
    ADD CONSTRAINT book_cover_assets_library_root_id_relative_path_key UNIQUE (library_root_id, relative_path);

ALTER TABLE ONLY book_cover_assets
    ADD CONSTRAINT book_cover_assets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY book_files
    ADD CONSTRAINT book_files_library_root_id_normalized_path_key UNIQUE (library_root_id, normalized_path);

ALTER TABLE ONLY book_files
    ADD CONSTRAINT book_files_pkey PRIMARY KEY (id);

ALTER TABLE ONLY book_knowledge
    ADD CONSTRAINT book_knowledge_pkey PRIMARY KEY (book_id);

ALTER TABLE ONLY book_reviews
    ADD CONSTRAINT book_reviews_pkey PRIMARY KEY (id);

ALTER TABLE ONLY book_tags
    ADD CONSTRAINT book_tags_pkey PRIMARY KEY (book_id, tag_id);

ALTER TABLE ONLY book_uploads
    ADD CONSTRAINT book_uploads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY book_uploads
    ADD CONSTRAINT book_uploads_requested_by_idempotency_key_key UNIQUE (requested_by, idempotency_key);

ALTER TABLE ONLY booklist_entries
    ADD CONSTRAINT booklist_entries_pkey PRIMARY KEY (booklist_id, book_id);

ALTER TABLE ONLY booklists
    ADD CONSTRAINT booklists_pkey PRIMARY KEY (id);

ALTER TABLE ONLY books
    ADD CONSTRAINT books_pkey PRIMARY KEY (id);

ALTER TABLE ONLY catalog_duplicate_candidates
    ADD CONSTRAINT catalog_duplicate_candidates_pkey PRIMARY KEY (library_root_id, normalized_path);

ALTER TABLE ONLY catalog_state
    ADD CONSTRAINT catalog_state_pkey PRIMARY KEY (id);

ALTER TABLE ONLY categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY content_storage_scans
    ADD CONSTRAINT content_storage_scans_pkey PRIMARY KEY (kind);

ALTER TABLE ONLY display_catalog_entries
    ADD CONSTRAINT display_catalog_entries_catalog_id_book_id_key UNIQUE (catalog_id, book_id);

ALTER TABLE ONLY display_catalog_entries
    ADD CONSTRAINT display_catalog_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY display_catalog
    ADD CONSTRAINT display_catalog_pkey PRIMARY KEY (id);

ALTER TABLE ONLY file_leases
    ADD CONSTRAINT file_leases_book_file_id_holder_id_key UNIQUE (book_file_id, holder_id);

ALTER TABLE ONLY file_leases
    ADD CONSTRAINT file_leases_pkey PRIMARY KEY (id);

ALTER TABLE ONLY file_operation_previews
    ADD CONSTRAINT file_operation_previews_pkey PRIMARY KEY (token);

ALTER TABLE ONLY file_operations
    ADD CONSTRAINT file_operations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY file_operations
    ADD CONSTRAINT file_operations_requested_by_idempotency_key_key UNIQUE (requested_by, idempotency_key);

ALTER TABLE ONLY file_versions
    ADD CONSTRAINT file_versions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY batch_job_instance
    ADD CONSTRAINT job_inst_un UNIQUE (job_name, job_key);

ALTER TABLE ONLY library_roots
    ADD CONSTRAINT library_roots_pkey PRIMARY KEY (id);

ALTER TABLE ONLY mail_settings
    ADD CONSTRAINT mail_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY metadata_lookup_cache
    ADD CONSTRAINT metadata_lookup_cache_pkey PRIMARY KEY (provider, query_hash);

ALTER TABLE ONLY password_policy
    ADD CONSTRAINT password_policy_pkey PRIMARY KEY (id);

ALTER TABLE ONLY personal_vault
    ADD CONSTRAINT personal_vault_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY reader_fonts
    ADD CONSTRAINT reader_fonts_fingerprint_key UNIQUE (fingerprint);

ALTER TABLE ONLY reader_fonts
    ADD CONSTRAINT reader_fonts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY reading_positions
    ADD CONSTRAINT reading_positions_pkey PRIMARY KEY (user_id, book_id);

ALTER TABLE ONLY reading_time_daily
    ADD CONSTRAINT reading_time_daily_pkey PRIMARY KEY (user_id, book_id, reading_date);

ALTER TABLE ONLY recovery_mailboxes
    ADD CONSTRAINT recovery_mailboxes_email_key UNIQUE (email);

ALTER TABLE ONLY recovery_mailboxes
    ADD CONSTRAINT recovery_mailboxes_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY recovery_tokens
    ADD CONSTRAINT recovery_tokens_pkey PRIMARY KEY (token_hash);

ALTER TABLE ONLY recycle_bin_entries
    ADD CONSTRAINT recycle_bin_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY role_permission_policy
    ADD CONSTRAINT role_permission_policy_pkey PRIMARY KEY (id);

ALTER TABLE ONLY security_settings
    ADD CONSTRAINT security_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY series
    ADD CONSTRAINT series_pkey PRIMARY KEY (id);

ALTER TABLE ONLY session_revocation
    ADD CONSTRAINT session_revocation_pkey PRIMARY KEY (session_primary_id);

ALTER TABLE ONLY site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY spring_session_attributes
    ADD CONSTRAINT spring_session_attributes_pk PRIMARY KEY (session_primary_id, attribute_name);

ALTER TABLE ONLY spring_session
    ADD CONSTRAINT spring_session_pk PRIMARY KEY (primary_id);

ALTER TABLE ONLY tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);

ALTER TABLE ONLY two_factor_credentials
    ADD CONSTRAINT two_factor_credentials_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY two_factor_recovery_codes
    ADD CONSTRAINT two_factor_recovery_codes_pkey PRIMARY KEY (user_id, code_hash);

ALTER TABLE ONLY vault_chunks
    ADD CONSTRAINT vault_chunks_pkey PRIMARY KEY (user_id, object_id, chunk_index);

ALTER TABLE ONLY vault_chunks
    ADD CONSTRAINT vault_chunks_storage_id_key UNIQUE (storage_id);

ALTER TABLE ONLY vault_objects
    ADD CONSTRAINT vault_objects_pkey PRIMARY KEY (user_id, id);

ALTER TABLE ONLY vault_policy
    ADD CONSTRAINT vault_policy_pkey PRIMARY KEY (id);

CREATE INDEX articles_created ON articles USING btree (created_at DESC);

CREATE INDEX articles_duplicate_content ON articles USING btree (duplicate_content_key) WHERE ((duplicate_content_key)::text <> ''::text);

CREATE INDEX articles_duplicate_source ON articles USING btree (duplicate_source_key) WHERE ((duplicate_source_key)::text <> ''::text);

CREATE INDEX ix_annotations_private_feed ON annotations USING btree (user_id, updated_at DESC, id DESC);

CREATE INDEX ix_annotations_user_book ON annotations USING btree (user_id, book_id, locator);

CREATE INDEX ix_article_collection_articles_order ON article_collection_articles USING btree (collection_id, "position", article_id);

CREATE INDEX ix_article_collections_owner_updated ON article_collections USING btree (owner_id, updated_at DESC, id);

CREATE INDEX ix_article_collections_visibility_updated ON article_collections USING btree (visibility, updated_at DESC, id);

CREATE INDEX ix_article_posts_owner_created ON article_posts USING btree (user_id, created_at DESC, id DESC);

CREATE INDEX ix_article_reading_user_article ON article_reading USING btree (user_id, article_id);

CREATE INDEX ix_audit_events_actor ON audit_events USING btree (actor_id, occurred_at DESC);

CREATE INDEX ix_audit_events_time ON audit_events USING btree (occurred_at DESC, id DESC);

CREATE INDEX ix_authors_name_trgm ON authors USING gin (name gin_trgm_ops);

CREATE INDEX ix_book_categories_category ON book_categories USING btree (category_id, book_id);

CREATE INDEX ix_book_cover_assets_book ON book_cover_assets USING btree (book_id, created_at DESC);

CREATE INDEX ix_book_cover_assets_expiry ON book_cover_assets USING btree (expires_at) WHERE (retired_at IS NOT NULL);

CREATE INDEX ix_book_files_book ON book_files USING btree (book_id, status);

CREATE INDEX ix_book_files_fingerprint ON book_files USING btree (fingerprint);

CREATE INDEX ix_book_files_scan ON book_files USING btree (library_root_id, last_seen_scan_id);

CREATE INDEX ix_book_reviews_book_owner_created ON book_reviews USING btree (book_id, user_id, created_at DESC, id DESC);

CREATE INDEX ix_book_reviews_book_visibility_created ON book_reviews USING btree (book_id, visibility, created_at DESC, id DESC);

CREATE INDEX ix_book_reviews_owner_created ON book_reviews USING btree (user_id, created_at DESC, id DESC);

CREATE INDEX ix_book_uploads_actor ON book_uploads USING btree (requested_by, created_at DESC);

CREATE INDEX ix_book_uploads_cleanup ON book_uploads USING btree (expires_at) WHERE ((status)::text <> ALL ((ARRAY['SUCCEEDED'::character varying, 'CANCELLED'::character varying, 'EXPIRED'::character varying])::text[]));

CREATE INDEX ix_book_uploads_status ON book_uploads USING btree (status, updated_at);

CREATE INDEX ix_booklist_entries_order ON booklist_entries USING btree (booklist_id, sort_order, book_id);

CREATE INDEX ix_booklists_discovery ON booklists USING btree (kind, visibility, sort_order, id);

CREATE INDEX ix_booklists_owner ON booklists USING btree (owner_id, sort_order, id);

CREATE INDEX ix_books_added_cursor ON books USING btree (created_at DESC, id DESC);

CREATE INDEX ix_books_author_cursor ON books USING btree (lower(primary_author), id);

CREATE INDEX ix_books_author_trgm ON books USING gin (primary_author gin_trgm_ops);

CREATE INDEX ix_books_series ON books USING btree (series_id, series_index);

CREATE INDEX ix_books_subject_codes_gin ON books USING gin (subject_codes);

CREATE INDEX ix_books_title_cursor ON books USING btree (sort_title, id);

CREATE INDEX ix_books_title_trgm ON books USING gin (title gin_trgm_ops);

CREATE INDEX ix_catalog_duplicate_candidates_fingerprint ON catalog_duplicate_candidates USING btree (fingerprint);

CREATE INDEX ix_categories_order ON categories USING btree (sort_order, id);

CREATE INDEX ix_display_catalog_entries_order ON display_catalog_entries USING btree (catalog_id, sort_order, id);

CREATE INDEX ix_file_leases_active ON file_leases USING btree (book_file_id, expires_at);

CREATE INDEX ix_file_operation_previews_expiry ON file_operation_previews USING btree (expires_at);

CREATE INDEX ix_file_operations_history ON file_operations USING btree (created_at DESC, id DESC);

CREATE INDEX ix_file_operations_worker ON file_operations USING btree (status, created_at) WHERE ((status)::text = 'PLANNED'::text);

CREATE INDEX ix_file_versions_book ON file_versions USING btree (book_file_id, created_at DESC);

CREATE INDEX ix_file_versions_expiry ON file_versions USING btree (expires_at) WHERE (restored_at IS NULL);

CREATE INDEX ix_metadata_lookup_cache_expiry ON metadata_lookup_cache USING btree (expires_at);

CREATE INDEX ix_reader_fonts_status ON reader_fonts USING btree (status, created_at DESC);

CREATE INDEX ix_reading_positions_user_updated ON reading_positions USING btree (user_id, updated_at DESC);

CREATE INDEX ix_reading_time_daily_user_date ON reading_time_daily USING btree (user_id, reading_date DESC);

CREATE INDEX ix_recycle_bin_active ON recycle_bin_entries USING btree (expires_at, id) WHERE ((restored_at IS NULL) AND (purged_at IS NULL));

CREATE INDEX ix_series_name_trgm ON series USING gin (name gin_trgm_ops);

CREATE INDEX ix_tags_name_trgm ON tags USING gin (name gin_trgm_ops);

CREATE INDEX recovery_tokens_user ON recovery_tokens USING btree (user_id);

CREATE UNIQUE INDEX spring_session_ix1 ON spring_session USING btree (session_id);

CREATE INDEX spring_session_ix2 ON spring_session USING btree (expiry_time);

CREATE INDEX spring_session_ix3 ON spring_session USING btree (principal_name);

CREATE UNIQUE INDEX ux_app_users_username_lower ON app_users USING btree (lower((username)::text));

CREATE UNIQUE INDEX ux_categories_name_lower ON categories USING btree (lower((name)::text));

CREATE UNIQUE INDEX ux_library_roots_configured_path ON library_roots USING btree (configured_path);

CREATE UNIQUE INDEX ux_library_roots_name_lower ON library_roots USING btree (lower((name)::text));

CREATE UNIQUE INDEX ux_series_name_lower ON series USING btree (lower(name));

CREATE UNIQUE INDEX ux_single_owner ON app_users USING btree (role) WHERE ((role)::text = 'OWNER'::text);

CREATE UNIQUE INDEX ux_tags_name_lower ON tags USING btree (lower(name));

CREATE TRIGGER bookkin_claim_book_content_trigger BEFORE INSERT OR UPDATE OF fingerprint, book_id, status ON book_files FOR EACH ROW EXECUTE FUNCTION bookkin_claim_book_content();

CREATE TRIGGER catalog_revision_book_authors AFTER INSERT OR DELETE OR UPDATE ON book_authors FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();

CREATE TRIGGER catalog_revision_book_files AFTER INSERT OR DELETE ON book_files FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();

CREATE TRIGGER catalog_revision_book_files_update AFTER UPDATE OF book_id, library_root_id, relative_path, normalized_path, format, status, fingerprint, page_count, word_count, encrypted, drm_protected, digitally_signed ON book_files FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();

CREATE TRIGGER catalog_revision_book_tags AFTER INSERT OR DELETE OR UPDATE ON book_tags FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();

CREATE TRIGGER catalog_revision_books AFTER INSERT OR DELETE OR UPDATE ON books FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();

CREATE TRIGGER catalog_revision_cover_assets AFTER INSERT OR DELETE OR UPDATE ON book_cover_assets FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();

CREATE TRIGGER catalog_revision_library_roots AFTER UPDATE OF name ON library_roots FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();

CREATE TRIGGER catalog_revision_series AFTER INSERT OR DELETE OR UPDATE ON series FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();

ALTER TABLE ONLY ai_provider_settings
    ADD CONSTRAINT ai_provider_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES app_users(id);

ALTER TABLE ONLY ai_settings
    ADD CONSTRAINT ai_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES app_users(id);

ALTER TABLE ONLY annotations
    ADD CONSTRAINT annotations_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

ALTER TABLE ONLY annotations
    ADD CONSTRAINT annotations_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY article_asset_links
    ADD CONSTRAINT article_asset_links_article_id_fkey FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE;

ALTER TABLE ONLY article_asset_links
    ADD CONSTRAINT article_asset_links_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES article_assets(id);

ALTER TABLE ONLY article_assets
    ADD CONSTRAINT article_assets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES app_users(id);

ALTER TABLE ONLY article_collection_articles
    ADD CONSTRAINT article_collection_articles_article_id_fkey FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE;

ALTER TABLE ONLY article_collection_articles
    ADD CONSTRAINT article_collection_articles_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES article_collections(id) ON DELETE CASCADE;

ALTER TABLE ONLY article_collections
    ADD CONSTRAINT article_collections_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY article_posts
    ADD CONSTRAINT article_posts_article_id_fkey FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE;

ALTER TABLE ONLY article_posts
    ADD CONSTRAINT article_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY article_reading
    ADD CONSTRAINT article_reading_article_id_fkey FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE;

ALTER TABLE ONLY article_reading
    ADD CONSTRAINT article_reading_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY articles
    ADD CONSTRAINT articles_cover_asset_id_fkey FOREIGN KEY (cover_asset_id) REFERENCES article_assets(id);

ALTER TABLE ONLY articles
    ADD CONSTRAINT articles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES app_users(id);

ALTER TABLE ONLY audit_events
    ADD CONSTRAINT audit_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES app_users(id);

ALTER TABLE ONLY batch_job_execution_context
    ADD CONSTRAINT batch_job_execution_context_job_execution_id_fkey FOREIGN KEY (job_execution_id) REFERENCES batch_job_execution(job_execution_id);

ALTER TABLE ONLY batch_job_execution
    ADD CONSTRAINT batch_job_execution_job_instance_id_fkey FOREIGN KEY (job_instance_id) REFERENCES batch_job_instance(job_instance_id);

ALTER TABLE ONLY batch_job_execution_params
    ADD CONSTRAINT batch_job_execution_params_job_execution_id_fkey FOREIGN KEY (job_execution_id) REFERENCES batch_job_execution(job_execution_id);

ALTER TABLE ONLY batch_step_execution_context
    ADD CONSTRAINT batch_step_execution_context_step_execution_id_fkey FOREIGN KEY (step_execution_id) REFERENCES batch_step_execution(step_execution_id);

ALTER TABLE ONLY batch_step_execution
    ADD CONSTRAINT batch_step_execution_job_execution_id_fkey FOREIGN KEY (job_execution_id) REFERENCES batch_job_execution(job_execution_id);

ALTER TABLE ONLY book_authors
    ADD CONSTRAINT book_authors_author_id_fkey FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE;

ALTER TABLE ONLY book_authors
    ADD CONSTRAINT book_authors_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

ALTER TABLE ONLY book_categories
    ADD CONSTRAINT book_categories_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

ALTER TABLE ONLY book_categories
    ADD CONSTRAINT book_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;

ALTER TABLE ONLY book_categories
    ADD CONSTRAINT book_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id);

ALTER TABLE ONLY book_cover_assets
    ADD CONSTRAINT book_cover_assets_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

ALTER TABLE ONLY book_cover_assets
    ADD CONSTRAINT book_cover_assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id);

ALTER TABLE ONLY book_cover_assets
    ADD CONSTRAINT book_cover_assets_library_root_id_fkey FOREIGN KEY (library_root_id) REFERENCES library_roots(id);

ALTER TABLE ONLY book_files
    ADD CONSTRAINT book_files_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

ALTER TABLE ONLY book_files
    ADD CONSTRAINT book_files_library_root_id_fkey FOREIGN KEY (library_root_id) REFERENCES library_roots(id);

ALTER TABLE ONLY book_knowledge
    ADD CONSTRAINT book_knowledge_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

ALTER TABLE ONLY book_knowledge
    ADD CONSTRAINT book_knowledge_file_id_fkey FOREIGN KEY (file_id) REFERENCES book_files(id) ON DELETE CASCADE;

ALTER TABLE ONLY book_reviews
    ADD CONSTRAINT book_reviews_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

ALTER TABLE ONLY book_reviews
    ADD CONSTRAINT book_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY book_tags
    ADD CONSTRAINT book_tags_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

ALTER TABLE ONLY book_tags
    ADD CONSTRAINT book_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;

ALTER TABLE ONLY book_uploads
    ADD CONSTRAINT book_uploads_committed_book_id_fkey FOREIGN KEY (committed_book_id) REFERENCES books(id);

ALTER TABLE ONLY book_uploads
    ADD CONSTRAINT book_uploads_duplicate_book_id_fkey FOREIGN KEY (duplicate_book_id) REFERENCES books(id);

ALTER TABLE ONLY book_uploads
    ADD CONSTRAINT book_uploads_library_root_id_fkey FOREIGN KEY (library_root_id) REFERENCES library_roots(id);

ALTER TABLE ONLY book_uploads
    ADD CONSTRAINT book_uploads_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES app_users(id);

ALTER TABLE ONLY booklist_entries
    ADD CONSTRAINT booklist_entries_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

ALTER TABLE ONLY booklist_entries
    ADD CONSTRAINT booklist_entries_booklist_id_fkey FOREIGN KEY (booklist_id) REFERENCES booklists(id) ON DELETE CASCADE;

ALTER TABLE ONLY booklists
    ADD CONSTRAINT booklists_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY books
    ADD CONSTRAINT books_cover_asset_id_fkey FOREIGN KEY (cover_asset_id) REFERENCES book_cover_assets(id);

ALTER TABLE ONLY books
    ADD CONSTRAINT books_series_id_fkey FOREIGN KEY (series_id) REFERENCES series(id);

ALTER TABLE ONLY catalog_duplicate_candidates
    ADD CONSTRAINT catalog_duplicate_candidates_existing_book_id_fkey FOREIGN KEY (existing_book_id) REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE ONLY catalog_duplicate_candidates
    ADD CONSTRAINT catalog_duplicate_candidates_library_root_id_fkey FOREIGN KEY (library_root_id) REFERENCES library_roots(id) ON DELETE CASCADE;

ALTER TABLE ONLY categories
    ADD CONSTRAINT categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id);

ALTER TABLE ONLY display_catalog_entries
    ADD CONSTRAINT display_catalog_entries_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

ALTER TABLE ONLY display_catalog_entries
    ADD CONSTRAINT display_catalog_entries_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES display_catalog(id) ON DELETE CASCADE;

ALTER TABLE ONLY display_catalog_entries
    ADD CONSTRAINT display_catalog_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id);

ALTER TABLE ONLY file_operation_previews
    ADD CONSTRAINT file_operation_previews_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES app_users(id);

ALTER TABLE ONLY file_operation_previews
    ADD CONSTRAINT file_operation_previews_source_root_id_fkey FOREIGN KEY (source_root_id) REFERENCES library_roots(id);

ALTER TABLE ONLY file_operation_previews
    ADD CONSTRAINT file_operation_previews_target_root_id_fkey FOREIGN KEY (target_root_id) REFERENCES library_roots(id);

ALTER TABLE ONLY file_operations
    ADD CONSTRAINT file_operations_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES app_users(id);

ALTER TABLE ONLY file_operations
    ADD CONSTRAINT file_operations_source_root_id_fkey FOREIGN KEY (source_root_id) REFERENCES library_roots(id);

ALTER TABLE ONLY file_operations
    ADD CONSTRAINT file_operations_target_root_id_fkey FOREIGN KEY (target_root_id) REFERENCES library_roots(id);

ALTER TABLE ONLY file_versions
    ADD CONSTRAINT file_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users(id);

ALTER TABLE ONLY file_versions
    ADD CONSTRAINT file_versions_library_root_id_fkey FOREIGN KEY (library_root_id) REFERENCES library_roots(id);

ALTER TABLE ONLY personal_vault
    ADD CONSTRAINT personal_vault_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY reader_fonts
    ADD CONSTRAINT reader_fonts_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES app_users(id);

ALTER TABLE ONLY reading_positions
    ADD CONSTRAINT reading_positions_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

ALTER TABLE ONLY reading_positions
    ADD CONSTRAINT reading_positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY reading_time_daily
    ADD CONSTRAINT reading_time_daily_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

ALTER TABLE ONLY reading_time_daily
    ADD CONSTRAINT reading_time_daily_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY recovery_mailboxes
    ADD CONSTRAINT recovery_mailboxes_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY recovery_tokens
    ADD CONSTRAINT recovery_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY recycle_bin_entries
    ADD CONSTRAINT recycle_bin_entries_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES app_users(id);

ALTER TABLE ONLY recycle_bin_entries
    ADD CONSTRAINT recycle_bin_entries_library_root_id_fkey FOREIGN KEY (library_root_id) REFERENCES library_roots(id);

ALTER TABLE ONLY role_permission_policy
    ADD CONSTRAINT role_permission_policy_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES app_users(id);

ALTER TABLE ONLY session_revocation
    ADD CONSTRAINT session_revocation_session_primary_id_fkey FOREIGN KEY (session_primary_id) REFERENCES spring_session(primary_id) ON DELETE CASCADE;

ALTER TABLE ONLY spring_session_attributes
    ADD CONSTRAINT spring_session_attributes_fk FOREIGN KEY (session_primary_id) REFERENCES spring_session(primary_id) ON DELETE CASCADE;

ALTER TABLE ONLY two_factor_credentials
    ADD CONSTRAINT two_factor_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE ONLY two_factor_recovery_codes
    ADD CONSTRAINT two_factor_recovery_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES two_factor_credentials(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY vault_chunks
    ADD CONSTRAINT vault_chunks_user_id_object_id_fkey FOREIGN KEY (user_id, object_id) REFERENCES vault_objects(user_id, id) ON DELETE CASCADE;

ALTER TABLE ONLY vault_objects
    ADD CONSTRAINT vault_objects_user_id_fkey FOREIGN KEY (user_id) REFERENCES personal_vault(user_id) ON DELETE CASCADE;

-- System defaults only. A new installation contains no users, books or reading activity.
INSERT INTO display_catalog(id) VALUES (1);
INSERT INTO catalog_state(id) VALUES (1);
INSERT INTO security_settings(id, registration_enabled) VALUES (1, false);
INSERT INTO password_policy VALUES (1,12,false,false,false,false);
INSERT INTO role_permission_policy(id) VALUES (1);
INSERT INTO vault_policy(id) VALUES (1);
INSERT INTO site_settings(id, settings) VALUES (1, '{"name": "BookKin", "tagline": "电子图书馆", "keywords": "", "copyright": "", "icpNumber": "", "publicUrl": "", "description": "你的 NAS 私人电子图书馆", "contactEmail": "", "policeNumber": "", "allowIndexing": false, "virtualLibraryEnabled": true}'::jsonb);
