package io.github.johntao2004.bookkin.reading;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.johntao2004.bookkin.catalog.BookFormat;
import io.github.johntao2004.bookkin.common.ApiException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletResponse;

class BookContentResponseTest {
    @TempDir
    Path directory;

    @Test
    void writesASelectedRangeSynchronouslyWithExpectedHeaders() throws Exception {
        Path file = directory.resolve("book.pdf");
        Files.write(file, new byte[] {0, 1, 2, 3, 4, 5, 6, 7});
        var response = new MockHttpServletResponse();
        var range = BookContentResponse.select(response, "bytes=2-5", 8);

        BookContentResponse.write(response, file, BookFormat.PDF, range, 8, false);

        assertEquals(206, response.getStatus());
        assertEquals("bytes", response.getHeader("Accept-Ranges"));
        assertEquals("bytes 2-5/8", response.getHeader("Content-Range"));
        assertEquals("application/pdf", response.getContentType());
        assertEquals(4, response.getContentLengthLong());
        assertArrayEquals(new byte[] {2, 3, 4, 5}, response.getContentAsByteArray());
    }

    @Test
    void supportsSuffixRangesAndRejectsInvalidOrEmptyFiles() {
        var response = new MockHttpServletResponse();
        assertEquals(new BookContentResponse.ByteRange(6, 7, true),
                BookContentResponse.select(response, "Bytes=-2", 8));
        ApiException invalid = assertThrows(ApiException.class,
                () -> BookContentResponse.select(response, "bytes=8-", 8));
        assertEquals(416, invalid.status().value());
        assertEquals("INVALID_RANGE", invalid.code());
        assertEquals("bytes */8", response.getHeader("Content-Range"));
        assertEquals("INVALID_RANGE", assertThrows(ApiException.class,
                () -> BookContentResponse.select(response, "bytes=1-2-3", 8)).code());
        assertEquals("BOOK_FILE_NOT_FOUND", assertThrows(ApiException.class,
                () -> BookContentResponse.select(response, null, 0)).code());
    }

    @Test
    void writesHeadersWithoutReadingTheBodyForHead() throws Exception {
        Path file = directory.resolve("book.epub");
        Files.write(file, new byte[] {0, 1, 2, 3});
        var response = new MockHttpServletResponse();
        var range = BookContentResponse.select(response, null, 4);

        BookContentResponse.write(response, file, BookFormat.EPUB, range, 4, true);

        assertEquals(200, response.getStatus());
        assertEquals("application/epub+zip", response.getContentType());
        assertEquals(4, response.getContentLengthLong());
        assertEquals(0, response.getContentAsByteArray().length);
    }
}
