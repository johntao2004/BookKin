package com.elexvx.bookkin.filemanagement;

import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.common.ApiException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class BookTitleFilenameTest {
    private final PathPolicy paths = new PathPolicy();

    @Test void preservesDirectoryFormatAndLiteralExtensionInTitle() {
        assertThat(BookTitleFilename.inDirectory("作者/old.PDF", "新书名", BookFormat.PDF, paths)).isEqualTo("作者/新书名.pdf");
        assertThat(BookTitleFilename.inDirectory("old.epub", "关于.pdf", BookFormat.EPUB, paths)).isEqualTo("关于.pdf.epub");
        assertThat(BookTitleFilename.inDirectory("old.epub", "../a\\b:c?", BookFormat.EPUB, paths)).isEqualTo(".. a b c.epub");
        assertThatThrownBy(() -> BookTitleFilename.inDirectory("../old.pdf", "书", BookFormat.PDF, paths)).isInstanceOf(ApiException.class);
    }

    @Test void handlesReservedNamesUnicodeAndFilesystemByteLimits() {
        assertThat(BookTitleFilename.segment("CON")).isEqualTo("_CON");
        assertThat(BookTitleFilename.segment(".bookkin-trash")).isEqualTo("_.bookkin-trash");
        assertThat(BookTitleFilename.segment("书名... ")).isEqualTo("书名");
        String longName = BookTitleFilename.segment("书😀".repeat(100));
        assertThat(longName.getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(240);
        assertThat(BookTitleFilename.segment(longName)).isEqualTo(longName);
    }
}
