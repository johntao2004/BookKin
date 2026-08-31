CREATE TABLE categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(160) NOT NULL,
    description text,
    sort_order bigint NOT NULL,
    created_by uuid REFERENCES app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_categories_name_lower ON categories (lower(name));
CREATE INDEX ix_categories_order ON categories (sort_order, id);

CREATE TABLE book_categories (
    book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_by uuid REFERENCES app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (book_id, category_id)
);

CREATE INDEX ix_book_categories_category ON book_categories (category_id, book_id);

CREATE TABLE booklists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    kind varchar(16) NOT NULL CHECK (kind IN ('OFFICIAL', 'PERSONAL')),
    visibility varchar(16) NOT NULL CHECK (visibility IN ('PRIVATE', 'MEMBERS', 'PUBLIC')),
    title varchar(240) NOT NULL,
    description text,
    sort_order bigint NOT NULL,
    revision bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_booklists_owner ON booklists (owner_id, sort_order, id);
CREATE INDEX ix_booklists_discovery ON booklists (kind, visibility, sort_order, id);

CREATE TABLE booklist_entries (
    booklist_id uuid NOT NULL REFERENCES booklists(id) ON DELETE CASCADE,
    book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    sort_order bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (booklist_id, book_id)
);

CREATE INDEX ix_booklist_entries_order ON booklist_entries (booklist_id, sort_order, book_id);
