ALTER TABLE book_authors DROP CONSTRAINT book_authors_pkey;
ALTER TABLE book_authors ADD COLUMN contributor_role varchar(16) NOT NULL DEFAULT 'AUTHOR'
    CHECK (contributor_role IN ('AUTHOR', 'TRANSLATOR'));
ALTER TABLE book_authors ADD PRIMARY KEY (book_id, author_id, contributor_role);

ALTER TABLE books ADD COLUMN metadata_sources jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE books ADD COLUMN metadata_overrides text[] NOT NULL DEFAULT array[]::text[];
ALTER TABLE book_files ADD COLUMN page_count integer;
ALTER TABLE book_files ADD COLUMN word_count bigint;

CREATE TABLE book_cover_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    library_root_id uuid NOT NULL REFERENCES library_roots(id),
    relative_path text NOT NULL,
    fingerprint varchar(80) NOT NULL,
    mime_type varchar(80) NOT NULL,
    width integer NOT NULL CHECK (width > 0),
    height integer NOT NULL CHECK (height > 0),
    source varchar(24) NOT NULL CHECK (source IN ('OPEN_LIBRARY', 'GOOGLE_BOOKS', 'CUSTOM')),
    created_by uuid NOT NULL REFERENCES app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    retired_at timestamptz,
    expires_at timestamptz,
    UNIQUE (library_root_id, relative_path)
);
CREATE INDEX ix_book_cover_assets_book ON book_cover_assets (book_id, created_at DESC);
CREATE INDEX ix_book_cover_assets_expiry ON book_cover_assets (expires_at) WHERE retired_at IS NOT NULL;
ALTER TABLE books ADD COLUMN cover_asset_id uuid REFERENCES book_cover_assets(id);

CREATE TABLE book_uploads (
    id uuid PRIMARY KEY,
    requested_by uuid NOT NULL REFERENCES app_users(id),
    library_root_id uuid NOT NULL REFERENCES library_roots(id),
    original_filename text NOT NULL,
    staging_path text NOT NULL,
    format varchar(8) NOT NULL CHECK (format IN ('EPUB', 'PDF')),
    declared_size_bytes bigint NOT NULL CHECK (declared_size_bytes >= 0),
    received_bytes bigint NOT NULL DEFAULT 0,
    fingerprint varchar(80),
    status varchar(32) NOT NULL CHECK (status IN ('RECEIVING', 'INSPECTING', 'ENRICHING', 'READY_FOR_REVIEW', 'COMMITTING', 'SUCCEEDED', 'DUPLICATE', 'FAILED', 'CANCELLED', 'EXPIRED')),
    encrypted boolean NOT NULL DEFAULT false,
    drm_protected boolean NOT NULL DEFAULT false,
    digitally_signed boolean NOT NULL DEFAULT false,
    detected_metadata jsonb,
    draft_metadata jsonb,
    metadata_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
    cover_cache_key text,
    selected_cover_source varchar(24),
    selected_cover_staging_path text,
    duplicate_book_id uuid REFERENCES books(id),
    similar_book_ids uuid[] NOT NULL DEFAULT array[]::uuid[],
    target_path text,
    error_code varchar(80),
    error_detail text,
    idempotency_key varchar(160),
    committed_book_id uuid REFERENCES books(id),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    UNIQUE (requested_by, idempotency_key)
);
CREATE INDEX ix_book_uploads_actor ON book_uploads (requested_by, created_at DESC);
CREATE INDEX ix_book_uploads_cleanup ON book_uploads (expires_at) WHERE status NOT IN ('SUCCEEDED', 'CANCELLED', 'EXPIRED');
CREATE INDEX ix_book_uploads_status ON book_uploads (status, updated_at);

CREATE TABLE metadata_lookup_cache (
    provider varchar(32) NOT NULL,
    query_hash varchar(80) NOT NULL,
    normalized_response jsonb NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, query_hash)
);
CREATE INDEX ix_metadata_lookup_cache_expiry ON metadata_lookup_cache (expires_at);
