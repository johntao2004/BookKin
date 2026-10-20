// 面向浏览的书目信息投影，不携带用户阅读进度或私人批注。
// Browse-oriented book projection without user reading positions or private annotations.
package com.elexvx.bookkin.catalog;

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
