package io.github.johntao2004.bookkin.catalog;

import java.time.OffsetDateTime;

public record BrowseBook(
        String id,
        String title,
        String author,
        String description,
        BookFormat format,
        String coverUrl,
        boolean available,
        OffsetDateTime addedAt) {
}
