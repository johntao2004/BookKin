-- Performance-only fixture: 100,000 logical books and 150,000 file rows.
-- It does not create files on disk and must never be run against production.
BEGIN;

INSERT INTO library_roots(id, name, configured_path, canonical_path, status, can_read, can_write, can_atomic_move, can_stage)
VALUES ('00000000-0000-0000-0000-000000000001', '十万册基准库', '/benchmark', '/benchmark', 'ONLINE', true, true, true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO books(id, title, sort_title, primary_author, description, language, created_at)
SELECT gen_random_uuid(),
       '基准藏书 ' || lpad(value::text, 6, '0'),
       '基准藏书 ' || lpad(value::text, 6, '0'),
       '作者 ' || lpad((value % 10000)::text, 5, '0'),
       '用于验证十万册游标分页、模糊搜索与索引性能的数据。',
       'zh-CN',
       timestamptz '2026-01-01 00:00:00+00' + value * interval '1 second'
FROM generate_series(1, 100000) AS value;

INSERT INTO book_files(id, book_id, library_root_id, relative_path, normalized_path, format, status,
                       size_bytes, modified_at, fingerprint, quick_fingerprint)
SELECT gen_random_uuid(), id, '00000000-0000-0000-0000-000000000001',
       primary_author || '/' || title || '.epub', lower(primary_author || '/' || title || '.epub'),
       'EPUB', 'AVAILABLE', 1048576 + row_number() OVER (), now(),
       'sha256:' || encode(digest(id::text || ':epub', 'sha256'), 'hex'),
       (1048576 + row_number() OVER ())::text || ':0'
FROM books
ORDER BY created_at
LIMIT 100000;

INSERT INTO book_files(id, book_id, library_root_id, relative_path, normalized_path, format, status,
                       size_bytes, modified_at, fingerprint, quick_fingerprint)
SELECT gen_random_uuid(), id, '00000000-0000-0000-0000-000000000001',
       primary_author || '/' || title || '.pdf', lower(primary_author || '/' || title || '.pdf'),
       'PDF', 'AVAILABLE', 2097152 + row_number() OVER (), now(),
       'sha256:' || encode(digest(id::text || ':pdf', 'sha256'), 'hex'),
       (2097152 + row_number() OVER ())::text || ':0'
FROM books
ORDER BY created_at
LIMIT 50000;

ANALYZE books;
ANALYZE book_files;
COMMIT;
