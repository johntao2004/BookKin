package io.github.johntao2004.bookkin.ingestion;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.johntao2004.bookkin.catalog.BookFormat;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BookMetadataExtractorTest {
    @TempDir Path directory;
    private final BookMetadataExtractor extractor = new BookMetadataExtractor();

    @Test
    void extractsExtendedEpubMetadataAndCover() throws Exception {
        Path epub = directory.resolve("sample.epub");
        try (var output = new ZipOutputStream(Files.newOutputStream(epub), StandardCharsets.UTF_8)) {
            entry(output, "mimetype", "application/epub+zip".getBytes(StandardCharsets.UTF_8));
            entry(output, "META-INF/container.xml", """
                    <?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
                    <rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>
                    """.getBytes(StandardCharsets.UTF_8));
            entry(output, "OPS/package.opf", """
                    <?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" xmlns:opf="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0">
                    <metadata><dc:title id="main-title">真实测试书</dc:title><dc:title id="sub-title">副标题</dc:title>
                    <meta refines="#sub-title" property="title-type">subtitle</meta>
                    <dc:creator id="a1">作者甲</dc:creator><dc:creator id="a2">作者乙</dc:creator>
                    <dc:contributor id="t1">译者丙</dc:contributor><meta refines="#t1" property="role">trl</meta>
                    <dc:language>zh-CN</dc:language><dc:publisher>BookKin出版社</dc:publisher><dc:date>2026-08-21</dc:date>
                    <dc:identifier opf:scheme="ISBN">978-7-0000-0000-1</dc:identifier><dc:subject>文学</dc:subject>
                    <meta name="calibre:series" content="山河集"/><meta name="calibre:series_index" content="2.5"/>
                    <meta name="cover" content="cover"/></metadata>
                    <manifest><item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>
                    <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>
                    """.getBytes(StandardCharsets.UTF_8));
            entry(output, "OPS/chapter.xhtml", "<html><body><p>山河之间 hello world</p></body></html>".getBytes(StandardCharsets.UTF_8));
            entry(output, "OPS/cover.png", Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="));
        }

        var value = extractor.extract(epub, BookFormat.EPUB, directory, "sha256:test");
        assertEquals("真实测试书", value.title());
        assertEquals("副标题", value.subtitle());
        assertEquals(java.util.List.of("作者甲", "作者乙"), value.authors());
        assertEquals(java.util.List.of("译者丙"), value.translators());
        assertEquals("山河集", value.series());
        assertEquals("2.5", value.seriesIndex().toPlainString());
        assertEquals("9787000000001", value.isbn());
        assertTrue(value.wordCount() >= 6);
        assertNotNull(value.coverCacheKey());
        assertTrue(Files.isRegularFile(directory.resolve(value.coverCacheKey())));
    }

    @Test
    void extractsPdfFactsAndFirstPageCover() throws Exception {
        Path pdf = directory.resolve("real.pdf");
        try (var document = new PDDocument()) {
            document.addPage(new PDPage());
            document.getDocumentInformation().setTitle("真实PDF");
            document.getDocumentInformation().setAuthor("作者甲; 作者乙");
            document.getDocumentInformation().setKeywords("历史, 随笔");
            document.save(pdf.toFile());
        }
        var value = extractor.extract(pdf, BookFormat.PDF, directory, "sha256:pdf");
        assertEquals("真实PDF", value.title());
        assertEquals(java.util.List.of("作者甲", "作者乙"), value.authors());
        assertEquals(1, value.pageCount());
        assertNotNull(value.coverCacheKey());
        assertTrue(Files.isRegularFile(directory.resolve(value.coverCacheKey())));
    }

    private void entry(ZipOutputStream output, String name, byte[] bytes) throws Exception {
        output.putNextEntry(new ZipEntry(name));
        output.write(bytes);
        output.closeEntry();
    }
}
