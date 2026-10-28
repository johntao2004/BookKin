CREATE TABLE language_terms (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    normalized_value text NOT NULL UNIQUE,
    value character varying(1024) NOT NULL,
    label character varying(1024) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT language_terms_value_check CHECK (char_length(value) BETWEEN 1 AND 1024),
    CONSTRAINT language_terms_label_check CHECK (char_length(label) BETWEEN 1 AND 1024)
);

CREATE TABLE knowledge_terms (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    normalized_value text NOT NULL UNIQUE,
    value character varying(60) NOT NULL,
    label character varying(60) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_terms_value_check CHECK (char_length(value) BETWEEN 1 AND 60),
    CONSTRAINT knowledge_terms_label_check CHECK (char_length(label) BETWEEN 1 AND 60)
);

CREATE TABLE book_knowledge_terms (
    book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    term_id uuid NOT NULL REFERENCES knowledge_terms(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (book_id, term_id)
);

CREATE INDEX ix_language_terms_value_lower ON language_terms (lower(value));
CREATE INDEX ix_language_terms_label_lower ON language_terms (lower(label));
CREATE INDEX ix_knowledge_terms_value_lower ON knowledge_terms (lower(value));
CREATE INDEX ix_book_knowledge_terms_term ON book_knowledge_terms (term_id, book_id);

-- Additive vocabulary backfill: preserve all existing book metadata and graph JSON.
WITH source_languages AS (
    SELECT btrim(regexp_replace(token, '[[:space:]]+', ' ', 'g')) AS value
      FROM books b
      CROSS JOIN LATERAL regexp_split_to_table(coalesce(b.language, ''), $pattern$[,，、;；|/\r\n]+$pattern$) AS parts(token)
), cleaned_languages AS (
    SELECT DISTINCT value, lower(value) AS normalized_value
      FROM source_languages
     WHERE value <> '' AND char_length(value) <= 1024
)
INSERT INTO language_terms(normalized_value, value, label)
SELECT normalized_value, value, value FROM cleaned_languages
ON CONFLICT (normalized_value) DO NOTHING;

WITH source_knowledge AS (
    SELECT k.book_id,
           btrim(regexp_replace(point->>'name', '[[:space:]]+', ' ', 'g')) AS value
      FROM book_knowledge k
      JOIN book_files f ON f.id = k.file_id AND f.book_id = k.book_id
      CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(k.points) = 'array' THEN k.points ELSE '[]'::jsonb END
      ) AS points(point)
     WHERE k.status = 'READY' AND f.status = 'AVAILABLE' AND f.fingerprint = k.fingerprint
), cleaned_knowledge AS (
    SELECT DISTINCT book_id, value, lower(value) AS normalized_value
      FROM source_knowledge
     WHERE value <> '' AND char_length(value) <= 60
)
INSERT INTO knowledge_terms(normalized_value, value, label)
SELECT DISTINCT normalized_value, value, value FROM cleaned_knowledge
ON CONFLICT (normalized_value) DO NOTHING;

WITH source_knowledge AS (
    SELECT k.book_id,
           btrim(regexp_replace(point->>'name', '[[:space:]]+', ' ', 'g')) AS value
      FROM book_knowledge k
      JOIN book_files f ON f.id = k.file_id AND f.book_id = k.book_id
      CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(k.points) = 'array' THEN k.points ELSE '[]'::jsonb END
      ) AS points(point)
     WHERE k.status = 'READY' AND f.status = 'AVAILABLE' AND f.fingerprint = k.fingerprint
), cleaned_knowledge AS (
    SELECT DISTINCT book_id, value, lower(value) AS normalized_value
      FROM source_knowledge
     WHERE value <> '' AND char_length(value) <= 60
)
INSERT INTO book_knowledge_terms(book_id, term_id)
SELECT DISTINCT source.book_id, term.id
  FROM cleaned_knowledge source
  JOIN knowledge_terms term ON term.normalized_value = source.normalized_value
ON CONFLICT DO NOTHING;
