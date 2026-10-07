-- A fingerprint belongs to one logical book. Several file rows for that book are
-- still valid during cross-root moves and while an older copy is in the trash.
CREATE TABLE book_content_claims (
    fingerprint varchar(80) PRIMARY KEY,
    book_id uuid NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Preserve existing catalog records. If an older installation already has
-- duplicates, claim the oldest available record; do not merge books or discard
-- private reading data during a schema migration.
INSERT INTO book_content_claims (fingerprint, book_id)
SELECT DISTINCT ON (fingerprint) fingerprint, book_id
  FROM book_files
 WHERE status <> 'DELETED'
 ORDER BY fingerprint,
          CASE status WHEN 'AVAILABLE' THEN 0 WHEN 'OPERATING' THEN 1
                      WHEN 'TRASHED' THEN 2 ELSE 3 END,
          created_at, id;

CREATE OR REPLACE FUNCTION bookkin_claim_book_content() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookkin_claim_book_content_trigger
BEFORE INSERT OR UPDATE OF fingerprint, book_id, status ON book_files
FOR EACH ROW EXECUTE FUNCTION bookkin_claim_book_content();

CREATE TABLE catalog_duplicate_candidates (
    library_root_id uuid NOT NULL REFERENCES library_roots(id) ON DELETE CASCADE,
    normalized_path text NOT NULL,
    relative_path text NOT NULL,
    quick_fingerprint varchar(120) NOT NULL,
    fingerprint varchar(80) NOT NULL,
    existing_book_id uuid REFERENCES books(id) ON DELETE SET NULL,
    last_seen_scan_id uuid NOT NULL,
    detected_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (library_root_id, normalized_path)
);
CREATE INDEX ix_catalog_duplicate_candidates_fingerprint ON catalog_duplicate_candidates (fingerprint);
