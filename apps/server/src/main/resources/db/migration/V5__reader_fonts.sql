CREATE TABLE reader_fonts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name varchar(160) NOT NULL,
    family_name varchar(160) NOT NULL,
    font_kind varchar(16) NOT NULL CHECK (font_kind IN ('SERIF', 'SANS')),
    source varchar(16) NOT NULL CHECK (source IN ('CUSTOM')),
    status varchar(16) NOT NULL DEFAULT 'DISABLED' CHECK (status IN ('ENABLED', 'DISABLED')),
    format varchar(8) NOT NULL CHECK (format IN ('WOFF2', 'WOFF', 'TTF', 'OTF')),
    mime_type varchar(120) NOT NULL,
    size_bytes bigint NOT NULL CHECK (size_bytes > 0),
    fingerprint varchar(80) NOT NULL UNIQUE,
    staging_path text,
    content_path text,
    license_note text,
    uploaded_by uuid NOT NULL REFERENCES app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_reader_fonts_status ON reader_fonts (status, created_at DESC);
