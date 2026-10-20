// 文件目录快照区分书籍、物理文件与书库根；指纹用于内容冲突检查，记录本身不提供访问授权。
// File-catalog snapshots separate book, physical file and root identity; fingerprints support conflict checks, not access authorization.
package com.elexvx.bookkin.catalog;

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
