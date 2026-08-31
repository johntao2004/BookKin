CREATE TABLE reading_time_daily (
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    reading_date date NOT NULL,
    seconds integer NOT NULL DEFAULT 0 CHECK (seconds >= 0 AND seconds <= 86400),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, book_id, reading_date)
);

CREATE INDEX ix_reading_time_daily_user_date ON reading_time_daily (user_id, reading_date DESC);
