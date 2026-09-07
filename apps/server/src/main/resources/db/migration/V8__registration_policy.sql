CREATE TABLE security_settings (
    id integer PRIMARY KEY CHECK (id = 1),
    registration_enabled boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO security_settings(id, registration_enabled) VALUES (1, false);
