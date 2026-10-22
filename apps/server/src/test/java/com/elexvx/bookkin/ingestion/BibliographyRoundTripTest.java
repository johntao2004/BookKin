package com.elexvx.bookkin.ingestion;

import static org.junit.jupiter.api.Assertions.*;
import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.catalog.BookMetadataRepository.BookMetadata;
import com.elexvx.bookkin.filemanagement.EpubMetadataWriter;
import com.elexvx.bookkin.filemanagement.PdfMetadataWriter;
import com.elexvx.bookkin.filemanagement.infrastructure.BookBibliographyReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BibliographyRoundTripTest {
    @TempDir Path directory;
    private final BookBibliographyReader reader = new BookBibliographyReader();
    @Test void readsEpubThemaAndOnlyTocNavigationThenWritesMetadataWithoutChangingNavOrBody() throws Exception {
        var source=directory.resolve("source.epub");epub(source,false);
        var parsed=reader.read(source,BookFormat.EPUB);
        assertEquals(List.of("PSAF","RNCB"),parsed.subjectCodes());
        assertEquals("第一章 生态\n第二章 修复",parsed.tableOfContents());
        assertEquals("原作者介绍",parsed.authorBiography());
        var written=directory.resolve("written.epub");
        new EpubMetadataWriter().write(source,written,metadata(),directory);
        var roundtrip=reader.read(written,BookFormat.EPUB);
        assertEquals(List.of("RNKH2"),roundtrip.subjectCodes());
        assertEquals("新作者介绍",roundtrip.authorBiography());
        assertEquals("人工校对目录",roundtrip.tableOfContents());
        try(var before=new ZipFile(source.toFile());var after=new ZipFile(written.toFile())) {
            for(var name:List.of("OPS/nav.xhtml","OPS/chapter.xhtml")) {
                assertArrayEquals(before.getInputStream(before.getEntry(name)).readAllBytes(),after.getInputStream(after.getEntry(name)).readAllBytes());
            }
        }
    }
    @Test void rejectsExternalEntitiesAndDoesNotLeakFilesystemContents() throws Exception {
        var source=directory.resolve("unsafe.epub");epub(source,true);
        assertThrows(Exception.class,()->reader.read(source,BookFormat.EPUB));
    }
    @Test void readsPdfOutlineAndRoundTripsExtraFieldsWithoutRemovingOutline() throws Exception {
        var source=directory.resolve("source.pdf");
        try(var document=new PDDocument()) {
            document.addPage(new PDPage());
            var outline=new PDDocumentOutline();var item=new PDOutlineItem();item.setTitle("第一章 PDF目录");outline.addLast(item);document.getDocumentCatalog().setDocumentOutline(outline);
            document.save(source.toFile());
        }
        assertEquals("第一章 PDF目录",reader.read(source,BookFormat.PDF).tableOfContents());
        var target=directory.resolve("target.pdf");new PdfMetadataWriter().write(source,target,metadata());
        var roundtrip=reader.read(target,BookFormat.PDF);
        assertEquals(List.of("RNKH2"),roundtrip.subjectCodes());assertEquals("新作者介绍",roundtrip.authorBiography());assertEquals("人工校对目录",roundtrip.tableOfContents());
        try(var document=org.apache.pdfbox.Loader.loadPDF(target.toFile())) { assertEquals("第一章 PDF目录",document.getDocumentCatalog().getDocumentOutline().getFirstChild().getTitle()); }
    }
    @Test void readsLegacyNcxWithExternalDtdDeclarationWithoutFetchingIt() throws Exception {
        var source=directory.resolve("legacy.epub");
        try(var zip=new ZipOutputStream(Files.newOutputStream(source))) {
            entry(zip,"META-INF/container.xml","<container><rootfiles><rootfile full-path='OPS/content.opf'/></rootfiles></container>");
            entry(zip,"OPS/content.opf","<package><metadata/><manifest><item href='toc.ncx' media-type='application/x-dtbncx+xml'/></manifest></package>");
            entry(zip,"OPS/toc.ncx","<!DOCTYPE ncx SYSTEM 'http://127.0.0.1:1/never-fetch.dtd'><ncx xmlns='http://www.daisy.org/z3986/2005/ncx/'><navMap><navPoint><navLabel><text>旧版目录</text></navLabel></navPoint></navMap></ncx>");
        }
        assertEquals("旧版目录",reader.read(source,BookFormat.EPUB).tableOfContents());
    }

    private BookMetadata metadata() { return new BookMetadata(UUID.randomUUID(),"标题",null,List.of("作者"),List.of(),"zh",null,null,null,"简介",null,null,List.of("普通标签"),List.of("RNKH2"),null,null,Map.of(),false,"新作者介绍","人工校对目录"); }
    private void epub(Path target,boolean unsafe) throws Exception {
        try(var zip=new ZipOutputStream(Files.newOutputStream(target))) {
            entry(zip,"mimetype","application/epub+zip");
            entry(zip,"META-INF/container.xml","<container xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\"><rootfiles><rootfile full-path=\"OPS/content.opf\"/></rootfiles></container>");
            entry(zip,"OPS/content.opf",(unsafe ? "<!DOCTYPE package [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]>" : "")+"""
                <package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
                <metadata><dc:title>测试书</dc:title><dc:subject opf:scheme="Thema">PSAF</dc:subject>
                <dc:subject id="biodiversity">生物多样性</dc:subject><meta refines="#biodiversity" property="authority">Thema</meta><meta refines="#biodiversity" property="term">RNCB</meta>
                <dc:subject>普通标签</dc:subject><meta name="bookkin:authorBiography" content="原作者介绍"/></metadata>
                <manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/></manifest></package>
                """);
            entry(zip,"OPS/nav.xhtml","""
                <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head><body>
                <nav epub:type="landmarks"><a href="chapter.xhtml">不要混入的导航</a></nav>
                <nav epub:type="toc"><ol><li><a href="chapter.xhtml">第一章 生态</a></li><li><a href="chapter.xhtml#second">第二章 修复</a></li></ol></nav></body></html>
                """);
            entry(zip,"OPS/chapter.xhtml","<html><body>正文保留原样</body></html>");
        }
    }
    private void entry(ZipOutputStream output,String name,String value) throws Exception {output.putNextEntry(new ZipEntry(name));output.write(value.getBytes(StandardCharsets.UTF_8));output.closeEntry();}
}
