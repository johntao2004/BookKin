CREATE TABLE metadata_provider_settings (
    provider_id character varying(32) NOT NULL,
    enabled boolean NOT NULL,
    updated_by uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metadata_provider_settings_pkey PRIMARY KEY (provider_id),
    CONSTRAINT metadata_provider_settings_provider_id_check
        CHECK (provider_id IN ('OPEN_LIBRARY', 'WIKIDATA', 'GOOGLE_BOOKS')),
    CONSTRAINT metadata_provider_settings_updated_by_fkey
        FOREIGN KEY (updated_by) REFERENCES app_users(id)
);
