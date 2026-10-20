// 验证有限采样保留页码/章节证据且不改原书，并拒绝外部实体、ZIP 逃逸与超大章节。
// Checks bounded sampling preserves page/chapter evidence without changing originals and rejects entities, ZIP escape and oversized chapters.
package com.elexvx.bookkin.filemanagement.infrastructure;

import static org.junit.jupiter.api.Assertions.*;
import com.elexvx.bookkin.catalog.BookFormat;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BookTextSamplerTest {
    @TempDir Path temporary;
    @Test void samplesAcrossTheEntireBookWithoutPretendingToReadEveryPage() {
        assertEquals(12, BookTextSampler.indexes(500).size());
        assertEquals(0, BookTextSampler.indexes(500).getFirst());
        assertEquals(499, BookTextSampler.indexes(500).getLast());
        assertEquals(java.util.List.of(), BookTextSampler.indexes(0));
        assertEquals(java.util.List.of(0), BookTextSampler.indexes(1));
    }
    @Test void readsRealPdfTextWithPageEvidenceWithoutChangingTheFile() throws Exception {
        Path path = temporary.resolve("book.pdf");
        try (var document = new PDDocument()) {
            var page = new PDPage(); document.addPage(page);
            try (var stream = new PDPageContentStream(document, page)) {
                stream.beginText(); stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                stream.newLineAtOffset(50, 700); stream.showText("Cognitive bias affects human decision making."); stream.endText();
            }
            document.save(path.toFile());
        }
        byte[] before = Files.readAllBytes(path);
        var sample = new BookTextSampler().sample(path, BookFormat.PDF);
        assertEquals(1, sample.totalSections());
        assertEquals("page:1", sample.passages().getFirst().locator());
        assertTrue(sample.passages().getFirst().text().contains("Cognitive bias"));
        assertArrayEquals(before, Files.readAllBytes(path));
    }
    @Test void usesEpubSpineIgnoresUnreferencedTextAndRejectsExternalEntities() throws Exception {
        Path path = epub("chapter.xhtml", "<!DOCTYPE html SYSTEM 'http://127.0.0.1:1/never-fetch.dtd'><html xmlns=\"http://www.w3.org/1999/xhtml\"><head><title>Not body</title></head><body><p>正文包含认知偏差的知识点。</p><script>evil()</script></body></html>");
        var sample = new BookTextSampler().sample(path, BookFormat.EPUB);
        assertEquals(1, sample.totalSections());
        assertEquals("OPS/chapter.xhtml", sample.passages().getFirst().locator());
        assertEquals("正文包含认知偏差的知识点。", sample.passages().getFirst().text());
        Path unsafe = epub("chapter.xhtml", "<!DOCTYPE html [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><html><body>&xxe;</body></html>");
        assertThrows(Exception.class, () -> new BookTextSampler().sample(unsafe, BookFormat.EPUB));
    }
    @Test void rejectsZipTraversalAndOversizedChapters() throws Exception {
        assertThrows(Exception.class, () -> new BookTextSampler().sample(epub("../../../escape.xhtml", "<html/>"), BookFormat.EPUB));
        assertThrows(Exception.class, () -> new BookTextSampler().sample(epub("chapter.xhtml", "x".repeat(2 * 1024 * 1024 + 1)), BookFormat.EPUB));
    }
    private Path epub(String href, String body) throws Exception {
        Path path = temporary.resolve(java.util.UUID.randomUUID() + ".epub");
        try (var zip = new ZipOutputStream(Files.newOutputStream(path))) {
            entry(zip, "META-INF/container.xml", "<container><rootfiles><rootfile full-path=\"OPS/book.opf\"/></rootfiles></container>");
            entry(zip, "OPS/book.opf", "<package><manifest><item id=\"c\" href=\"" + href + "\" media-type=\"application/xhtml+xml\"/></manifest><spine><itemref idref=\"c\"/></spine></package>");
            entry(zip, "OPS/chapter.xhtml", body);
            entry(zip, "OPS/ignored.xhtml", "<html><body>Do not read me</body></html>");
        }
        return path;
    }
    private void entry(ZipOutputStream zip, String name, String value) throws Exception {
        zip.putNextEntry(new ZipEntry(name)); zip.write(value.getBytes(StandardCharsets.UTF_8)); zip.closeEntry();
    }
}
