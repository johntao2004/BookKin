package io.github.johntao2004.bookkin.catalog;

import java.time.OffsetDateTime;
import java.util.UUID;

public record BookFile(
        UUID id,
        UUID bookId,
        UUID libraryRootId,
        String relativePath,
        BookFormat format,
        BookFileStatus status,
        long sizeBytes,
        OffsetDateTime modifiedAt,
        String fingerprint,
        boolean encrypted,
        boolean drmProtected,
        boolean digitallySigned) {}
