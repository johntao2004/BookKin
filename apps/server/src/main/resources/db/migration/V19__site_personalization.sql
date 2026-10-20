CREATE TABLE site_settings (
    id integer PRIMARY KEY CHECK (id = 1),
    settings jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO site_settings(id, settings) VALUES (1, '{"name":"BookKin","tagline":"电子图书馆","description":"你的 NAS 私人电子图书馆","keywords":"","publicUrl":"","allowIndexing":false,"icpNumber":"","policeNumber":"","copyright":"","contactEmail":""}');
