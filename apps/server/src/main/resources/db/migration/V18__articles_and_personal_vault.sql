CREATE TABLE articles (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES app_users(id), title varchar(300) NOT NULL,
 author varchar(300) NOT NULL DEFAULT '', source_url text NOT NULL DEFAULT '', published_at varchar(100) NOT NULL DEFAULT '',
 visibility varchar(16) NOT NULL CHECK (visibility IN ('PUBLIC','PRIVATE')), html text NOT NULL,
 tags varchar(1000) NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 knowledge jsonb NOT NULL DEFAULT '[]', knowledge_revision uuid
);
CREATE INDEX articles_created ON articles(created_at DESC);
CREATE TABLE article_assets (id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES app_users(id), mime varchar(30) NOT NULL);
CREATE TABLE article_asset_links (article_id uuid REFERENCES articles(id) ON DELETE CASCADE, asset_id uuid REFERENCES article_assets(id), PRIMARY KEY(article_id,asset_id));
CREATE TABLE article_reading (
 article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 state jsonb NOT NULL DEFAULT '{}', revision bigint NOT NULL DEFAULT 0, PRIMARY KEY(article_id,user_id)
);
CREATE TABLE personal_vault (
 user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE, envelope jsonb NOT NULL, revision bigint NOT NULL DEFAULT 1
);
CREATE TABLE vault_objects (
 id uuid NOT NULL, user_id uuid NOT NULL REFERENCES personal_vault(user_id) ON DELETE CASCADE,
 manifest text NOT NULL, state text NOT NULL, revision bigint NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,id)
);
ALTER TABLE vault_objects ADD COLUMN chunk_count integer NOT NULL DEFAULT 0;
CREATE TABLE vault_chunks (
 user_id uuid NOT NULL, object_id uuid NOT NULL, chunk_index integer NOT NULL CHECK(chunk_index BETWEEN 0 AND 1023),
 storage_id uuid NOT NULL UNIQUE, digest varchar(64) NOT NULL,
 PRIMARY KEY(user_id,object_id,chunk_index), FOREIGN KEY(user_id,object_id) REFERENCES vault_objects(user_id,id) ON DELETE CASCADE
);
