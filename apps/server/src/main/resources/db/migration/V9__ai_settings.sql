CREATE TABLE ai_settings (
    id integer PRIMARY KEY CHECK (id = 1),
    enabled boolean NOT NULL DEFAULT false,
    auto_match boolean NOT NULL DEFAULT true,
    max_candidates integer NOT NULL DEFAULT 4 CHECK (max_candidates BETWEEN 1 AND 10),
    timeout_seconds integer NOT NULL DEFAULT 20 CHECK (timeout_seconds BETWEEN 5 AND 120),
    updated_by uuid REFERENCES app_users(id),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_provider_settings (
    provider_id varchar(80) PRIMARY KEY,
    label varchar(120) NOT NULL,
    provider_type varchar(32) NOT NULL CHECK (provider_type IN ('OPENAI_COMPATIBLE', 'ANTHROPIC', 'GEMINI')),
    enabled boolean NOT NULL DEFAULT false,
    base_url varchar(500) NOT NULL DEFAULT '',
    api_key_ciphertext text,
    model varchar(200) NOT NULL DEFAULT '',
    updated_by uuid REFERENCES app_users(id),
    updated_at timestamptz NOT NULL DEFAULT now()
);
