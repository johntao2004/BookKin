-- Knowledge is derived from book text, independent of private reading data.
create table book_knowledge (
    book_id uuid primary key references books(id) on delete cascade,
    file_id uuid not null references book_files(id) on delete cascade,
    fingerprint text not null,
    status varchar(20) not null check (status in ('GENERATING', 'READY', 'FAILED')),
    operation_id uuid not null,
    started_at timestamptz not null default now(),
    generated_at timestamptz,
    provider_id text,
    sampled_sections integer not null default 0,
    total_sections integer not null default 0,
    points jsonb not null default '[]'::jsonb
);
