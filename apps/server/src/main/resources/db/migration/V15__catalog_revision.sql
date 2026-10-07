CREATE TABLE catalog_state (
    id smallint PRIMARY KEY CHECK (id = 1),
    revision bigint NOT NULL DEFAULT 0
);
INSERT INTO catalog_state(id) VALUES (1);

CREATE OR REPLACE FUNCTION bookkin_bump_catalog_revision() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER catalog_revision_books AFTER INSERT OR UPDATE OR DELETE ON books
FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();
CREATE TRIGGER catalog_revision_book_files AFTER INSERT OR DELETE ON book_files
FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();
CREATE TRIGGER catalog_revision_book_files_update
AFTER UPDATE OF book_id, library_root_id, relative_path, normalized_path, format, status,
                fingerprint, page_count, word_count, encrypted, drm_protected, digitally_signed ON book_files
FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();
CREATE TRIGGER catalog_revision_book_authors AFTER INSERT OR UPDATE OR DELETE ON book_authors
FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();
CREATE TRIGGER catalog_revision_book_tags AFTER INSERT OR UPDATE OR DELETE ON book_tags
FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();
CREATE TRIGGER catalog_revision_cover_assets AFTER INSERT OR UPDATE OR DELETE ON book_cover_assets
FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();
CREATE TRIGGER catalog_revision_series AFTER INSERT OR UPDATE OR DELETE ON series
FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();
CREATE TRIGGER catalog_revision_library_roots AFTER UPDATE OF name ON library_roots
FOR EACH ROW EXECUTE FUNCTION bookkin_bump_catalog_revision();

CREATE INDEX ix_reading_positions_user_updated ON reading_positions(user_id, updated_at DESC);
