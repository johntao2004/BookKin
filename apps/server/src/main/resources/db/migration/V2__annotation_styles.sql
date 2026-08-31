ALTER TABLE annotations
    ADD COLUMN annotation_style varchar(16) NOT NULL DEFAULT 'HIGHLIGHT'
    CHECK (annotation_style IN ('HIGHLIGHT', 'UNDERLINE', 'BOLD'));
