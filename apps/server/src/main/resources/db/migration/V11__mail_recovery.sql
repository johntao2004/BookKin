create table mail_settings (
 id integer primary key check (id = 1), enabled boolean not null default false,
 host varchar(253) not null, port integer not null check(port between 1 and 65535),
 security varchar(16) not null check(security in ('STARTTLS','TLS','LOCAL')),
 username varchar(320) not null default '', password_ciphertext text,
 sender varchar(320) not null, public_url varchar(1000) not null,
 updated_at timestamptz not null default now()
);
create table recovery_mailboxes (
 user_id uuid primary key references app_users(id) on delete cascade,
 email varchar(320) not null unique
);
create table recovery_tokens (
 token_hash varchar(64) primary key,
 user_id uuid not null references app_users(id) on delete cascade,
 purpose varchar(10) not null check(purpose in ('BIND','RESET')),
 email varchar(320) not null, password_hash varchar(255) not null,
 expires_at timestamptz not null
);
create index recovery_tokens_user on recovery_tokens(user_id);
