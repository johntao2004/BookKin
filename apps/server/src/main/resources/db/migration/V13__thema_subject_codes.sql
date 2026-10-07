ALTER TABLE books
    ADD COLUMN subject_codes text[] NOT NULL DEFAULT array[]::text[];

CREATE INDEX ix_books_subject_codes_gin
    ON books USING gin (subject_codes);
