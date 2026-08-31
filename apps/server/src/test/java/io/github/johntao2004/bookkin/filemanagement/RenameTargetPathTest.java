package io.github.johntao2004.bookkin.filemanagement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.johntao2004.bookkin.catalog.BookFile;
import io.github.johntao2004.bookkin.catalog.BookFileStatus;
import io.github.johntao2004.bookkin.catalog.BookFormat;
import io.github.johntao2004.bookkin.common.ApiException;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RenameTargetPathTest {
    private final PathPolicy pathPolicy = new PathPolicy();

    @Test
    void keepsTheOriginalDirectoryAndAutomaticallyRestoresTheFormat() {
        BookFile file = file("作者/论文.pdf", BookFormat.PDF);

        assertEquals("作者/新书名.pdf", RenameTargetPath.resolve(file, "新书名", pathPolicy));
        assertEquals("作者/新版.epub", RenameTargetPath.resolve(file("作者/论文.epub", BookFormat.EPUB), "新版.EPUB", pathPolicy));
    }

    @Test
    void rejectsPathSegmentsAndAConflictingBookExtension() {
        BookFile file = file("作者/论文.pdf", BookFormat.PDF);

        assertThrows(ApiException.class, () -> RenameTargetPath.resolve(file, "../越界", pathPolicy));
        assertThrows(ApiException.class, () -> RenameTargetPath.resolve(file, "其他目录/新书名", pathPolicy));
        assertThrows(ApiException.class, () -> RenameTargetPath.resolve(file, "新书名.epub", pathPolicy));
    }

    private BookFile file(String relativePath, BookFormat format) {
        return new BookFile(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), relativePath, format,
                BookFileStatus.AVAILABLE, 1, OffsetDateTime.now(), "sha256:test", false, false, false);
    }
}
