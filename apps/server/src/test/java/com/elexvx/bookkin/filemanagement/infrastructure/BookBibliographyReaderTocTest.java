package com.elexvx.bookkin.filemanagement.infrastructure;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.*;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.destination.PDPageFitDestination;

class BookBibliographyReaderTocTest {
    @Test void recognizesSourcePageIndexAndKeepsAll340Entries() throws Exception {
        try (var document = new PDDocument()) {
            var outline = new PDDocumentOutline();
            document.getDocumentCatalog().setDocumentOutline(outline);
            for (int i = 0; i < 347; i++) document.addPage(new PDPage());
            for (int i = 1; i <= 340; i++) {
                var item = new PDOutlineItem(); item.setTitle(String.valueOf(i));
                var destination = new PDPageFitDestination(); destination.setPage(document.getPage(i + 6));
                item.setDestination(destination); outline.addLast(item);
            }
            var contents = new BookBibliographyReader().pdfContents(document);
            assertEquals(340, contents.lines().count());
            assertTrue(contents.startsWith("第 1 页\n第 2 页"));
            assertTrue(contents.endsWith("第 340 页"));
        }
    }
    @Test void retainsNumberedChaptersSpanningMultiplePages() throws Exception {
        try (var document = new PDDocument()) {
            var outline = new PDDocumentOutline(); document.getDocumentCatalog().setDocumentOutline(outline);
            for (int i = 0; i < 40; i++) document.addPage(new PDPage());
            for (int i = 1; i <= 10; i++) {
                var item = new PDOutlineItem(); item.setTitle(String.valueOf(i));
                var destination = new PDPageFitDestination(); destination.setPage(document.getPage(i * 3));
                item.setDestination(destination); outline.addLast(item);
            }
            assertEquals("1\n2\n3\n4\n5\n6\n7\n8\n9\n10", new BookBibliographyReader().pdfContents(document));
        }
    }
}
