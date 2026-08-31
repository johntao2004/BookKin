package io.github.johntao2004.bookkin.annotations;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.johntao2004.bookkin.annotations.AnnotationExportService.ExportFormat;
import io.github.johntao2004.bookkin.annotations.AnnotationRepository.Annotation;
import io.github.johntao2004.bookkin.annotations.AnnotationRepository.AnnotationStyle;
import io.github.johntao2004.bookkin.annotations.AnnotationRepository.AnnotationType;
import java.io.ByteArrayInputStream;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;

class AnnotationExportServiceTest {
    private final AnnotationExportService service = new AnnotationExportService();

    @Test
    void createsReadableWordExportWithQuotesAndNotes() throws Exception {
        var file = service.export("山川与灯火", "顾远", annotations(), ExportFormat.DOCX);

        assertEquals("《山川与灯火》阅读笔记.docx", file.filename());
        assertEquals(AnnotationExportService.DOCX_MEDIA_TYPE, file.mediaType());
        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(file.content()))) {
            String text = document.getParagraphs().stream().map(paragraph -> paragraph.getText())
                    .reduce("", (left, right) -> left + "\n" + right);
            assertTrue(text.contains("山川与灯火"));
            assertTrue(text.contains("把一天的光慢慢折进书页"));
            assertTrue(text.contains("记住这束光。"));
            assertEquals("BookKin", document.getProperties().getCoreProperties().getCreator());
        }
    }

    @Test
    void createsFilterableExcelExportWithTypedDates() throws Exception {
        var file = service.export("山川与灯火", "顾远", annotations(), ExportFormat.XLSX);

        assertEquals("《山川与灯火》阅读笔记.xlsx", file.filename());
        assertEquals(AnnotationExportService.XLSX_MEDIA_TYPE, file.mediaType());
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(file.content()))) {
            assertEquals(2, workbook.getNumberOfSheets());
        }
    }

    @Test
    void writesExpectedExcelSheetsAndRows() throws Exception {
        var file = service.export("山川与灯火", "顾远", annotations(), ExportFormat.XLSX);

        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(file.content()))) {
            assertEquals("概览", workbook.getSheetName(0));
            assertEquals("批注明细", workbook.getSheetName(1));
            var details = workbook.getSheet("批注明细");
            assertEquals(3, details.getPhysicalNumberOfRows());
            assertEquals("高亮片段", details.getRow(0).getCell(6).getStringCellValue());
            assertEquals("把一天的光慢慢折进书页", details.getRow(1).getCell(6).getStringCellValue());
            assertTrue(org.apache.poi.ss.usermodel.DateUtil.isCellDateFormatted(details.getRow(1).getCell(9)));
            assertTrue(details.getCTWorksheet().isSetAutoFilter());
            var overview = workbook.getSheet("概览");
            assertEquals("COUNTA('批注明细'!A2:A3)", overview.getRow(3).getCell(1).getCellFormula());
            assertEquals("COUNTIF('批注明细'!D2:D3,\"笔记\")", overview.getRow(4).getCell(1).getCellFormula());
            assertEquals(2, overview.getRow(3).getCell(1).getNumericCellValue());
            assertEquals(1, overview.getRow(4).getCell(1).getNumericCellValue());
        }
    }

    private List<Annotation> annotations() {
        OffsetDateTime created = OffsetDateTime.parse("2026-08-21T03:00:00+08:00");
        return List.of(
                new Annotation(UUID.randomUUID(), UUID.randomUUID(), "山川与灯火", "顾远", AnnotationType.NOTE,
                        "epubcfi(/6/2!/4/2)", "把一天的光慢慢折进书页", "记住这束光。",
                        AnnotationStyle.HIGHLIGHT, "YELLOW", created, created),
                new Annotation(UUID.randomUUID(), UUID.randomUUID(), "山川与灯火", "顾远", AnnotationType.HIGHLIGHT,
                        "epubcfi(/6/2!/4/4)", "这里有人生活过", null,
                        AnnotationStyle.UNDERLINE, "GREEN", created.plusMinutes(5), created.plusMinutes(5)));
    }
}
