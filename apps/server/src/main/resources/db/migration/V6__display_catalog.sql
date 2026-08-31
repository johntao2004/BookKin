CREATE TABLE display_catalog (
    id smallint PRIMARY KEY CHECK (id = 1),
    revision bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO display_catalog (id) VALUES (1);

CREATE TABLE display_catalog_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id smallint NOT NULL REFERENCES display_catalog(id) ON DELETE CASCADE,
    book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    sort_order bigint NOT NULL,
    created_by uuid REFERENCES app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (catalog_id, book_id)
);

CREATE INDEX ix_display_catalog_entries_order ON display_catalog_entries (catalog_id, sort_order, id);

INSERT INTO display_catalog_entries (catalog_id, book_id, sort_order, created_by)
SELECT 1, b.id, row_number() over (ORDER BY b.created_at DESC, b.id DESC), NULL
  FROM books b
 WHERE EXISTS (
       SELECT 1 FROM book_files bf
        WHERE bf.book_id = b.id AND bf.status = 'AVAILABLE'
 );
