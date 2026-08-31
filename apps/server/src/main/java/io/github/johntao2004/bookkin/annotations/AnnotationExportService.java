package io.github.johntao2004.bookkin.annotations;

import io.github.johntao2004.bookkin.annotations.AnnotationRepository.Annotation;
import io.github.johntao2004.bookkin.annotations.AnnotationRepository.AnnotationStyle;
import io.github.johntao2004.bookkin.annotations.AnnotationRepository.AnnotationType;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.UnderlinePatterns;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFFooter;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPageMar;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPageSz;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr;
import org.springframework.stereotype.Service;

@Service
public class AnnotationExportService {
    static final String DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    static final String XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm", Locale.SIMPLIFIED_CHINESE);
    private static final String PRIMARY = "C9704D";
    private static final String INK = "2A2722";
    private static final String MUTED = "756E64";
    private static final String PAPER = "FAF7F0";
    private static final String CJK_FONT = "Arial Unicode MS";

    public ExportedFile export(String title, String author, List<Annotation> source, ExportFormat format) {
        List<Annotation> annotations = source.stream()
                .filter(annotation -> annotation.type() != AnnotationType.BOOKMARK)
                .sorted(Comparator.comparing(Annotation::createdAt).thenComparing(Annotation::id))
                .toList();
        if (annotations.isEmpty()) throw new IllegalArgumentException("没有可导出的批注");
        String safeTitle = sanitizeFilename(title);
        return switch (format) {
            case DOCX -> new ExportedFile("《" + safeTitle + "》阅读笔记.docx", DOCX_MEDIA_TYPE,
                    createWord(title, author, annotations));
            case XLSX -> new ExportedFile("《" + safeTitle + "》阅读笔记.xlsx", XLSX_MEDIA_TYPE,
                    createExcel(title, author, annotations));
        };
    }

    private byte[] createWord(String title, String author, List<Annotation> annotations) {
        try (XWPFDocument document = new XWPFDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            configurePage(document);
            document.getProperties().getCoreProperties().setTitle(title + " · 阅读笔记");
            document.getProperties().getCoreProperties().setSubjectProperty("BookKin阅读批注导出");
            document.getProperties().getCoreProperties().setCreator("BookKin");

            XWPFParagraph kicker = document.createParagraph();
            kicker.setAlignment(ParagraphAlignment.CENTER);
            kicker.setSpacingAfter(140);
            addRun(kicker, "BookKin · 阅读摘录", 10, PRIMARY, true);

            XWPFParagraph heading = document.createParagraph();
            heading.setAlignment(ParagraphAlignment.CENTER);
            heading.setSpacingAfter(100);
            addRun(heading, title, 24, INK, true);

            XWPFParagraph metadata = document.createParagraph();
            metadata.setAlignment(ParagraphAlignment.CENTER);
            metadata.setSpacingAfter(360);
            addRun(metadata, author + "  ·  " + annotations.size() + " 条批注  ·  导出于 " + DATE_TIME.format(java.time.OffsetDateTime.now()), 10, MUTED, false);

            int index = 1;
            for (Annotation annotation : annotations) {
                XWPFParagraph label = document.createParagraph();
                label.setSpacingBefore(index == 1 ? 0 : 240);
                label.setSpacingAfter(100);
                addRun(label, String.format(Locale.ROOT, "%02d", index) + "  " + label(annotation) + "  ·  " + DATE_TIME.format(annotation.createdAt()), 10, PRIMARY, true);

                if (annotation.quote() != null && !annotation.quote().isBlank()) {
                    XWPFParagraph quote = document.createParagraph();
                    quote.setIndentationLeft(360);
                    quote.setIndentationRight(240);
                    quote.setSpacingAfter(annotation.note() == null || annotation.note().isBlank() ? 120 : 80);
                    quote.setSpacingBetween(1.25);
                    XWPFRun quoteRun = addRun(quote, "“" + annotation.quote().trim() + "”", 12, INK, false);
                    styleAnnotationRun(quoteRun, annotation);
                }
                if (annotation.note() != null && !annotation.note().isBlank()) {
                    XWPFParagraph note = document.createParagraph();
                    note.setIndentationLeft(360);
                    note.setSpacingAfter(120);
                    note.setSpacingBetween(1.2);
                    addRun(note, "笔记  ", 10, MUTED, true);
                    addRun(note, annotation.note().trim(), 11, INK, false);
                }
                index += 1;
            }

            XWPFFooter footer = document.createFooter(org.apache.poi.wp.usermodel.HeaderFooterType.DEFAULT);
            XWPFParagraph footerParagraph = footer.createParagraph();
            footerParagraph.setAlignment(ParagraphAlignment.CENTER);
            addRun(footerParagraph, "由BookKin导出 · 仅包含当前账户的私人阅读数据", 9, MUTED, false);
            document.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Word 导出生成失败", exception);
        }
    }

    private byte[] createExcel(String title, String author, List<Annotation> annotations) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            workbook.getProperties().getCoreProperties().setTitle(title + " · 阅读笔记");
            workbook.getProperties().getCoreProperties().setCreator("BookKin");
            XSSFSheet overview = workbook.createSheet("概览");
            XSSFSheet details = workbook.createSheet("批注明细");
            overview.setDisplayGridlines(false);
            details.setDisplayGridlines(false);
            writeOverview(workbook, overview, title, author, annotations);
            writeDetails(workbook, details, title, author, annotations);
            workbook.getCreationHelper().createFormulaEvaluator().evaluateAll();
            workbook.setActiveSheet(0);
            workbook.setForceFormulaRecalculation(true);
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Excel 导出生成失败", exception);
        }
    }

    private void writeOverview(XSSFWorkbook workbook, XSSFSheet sheet, String title, String author, List<Annotation> annotations) {
        sheet.setColumnWidth(0, 18 * 256);
        sheet.setColumnWidth(1, 34 * 256);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 3));
        Cell titleCell = sheet.createRow(0).createCell(0);
        titleCell.setCellValue(title + " · 阅读笔记");
        titleCell.setCellStyle(titleStyle(workbook));
        int lastDetailRow = Math.max(2, annotations.size() + 1);
        String[] labels = {"作者", "批注总数", "笔记", "高亮", "下划线", "加粗", "导出时间"};
        String[] values = {author, null, null, null, null, null, DATE_TIME.format(java.time.OffsetDateTime.now())};
        String[] formulas = {
                null,
                "COUNTA('批注明细'!A2:A" + lastDetailRow + ")",
                "COUNTIF('批注明细'!D2:D" + lastDetailRow + ",\"笔记\")",
                "COUNTIF('批注明细'!E2:E" + lastDetailRow + ",\"高亮\")",
                "COUNTIF('批注明细'!E2:E" + lastDetailRow + ",\"下划线\")",
                "COUNTIF('批注明细'!E2:E" + lastDetailRow + ",\"加粗\")",
                null,
        };
        CellStyle labelStyle = summaryLabelStyle(workbook);
        CellStyle valueStyle = summaryValueStyle(workbook);
        for (int index = 0; index < labels.length; index += 1) {
            Row row = sheet.createRow(index + 2);
            row.setHeightInPoints(25);
            Cell label = row.createCell(0);
            label.setCellValue(labels[index]);
            label.setCellStyle(labelStyle);
            Cell value = row.createCell(1);
            if (formulas[index] != null) value.setCellFormula(formulas[index]);
            else value.setCellValue(values[index]);
            value.setCellStyle(valueStyle);
        }
        sheet.createFreezePane(0, 2);
    }

    private void writeDetails(XSSFWorkbook workbook, XSSFSheet sheet, String title, String author, List<Annotation> annotations) {
        String[] headers = {"序号", "书名", "作者", "类型", "样式", "颜色", "高亮片段", "笔记", "定位", "创建时间", "更新时间"};
        Row header = sheet.createRow(0);
        header.setHeightInPoints(28);
        CellStyle headerStyle = tableHeaderStyle(workbook);
        for (int column = 0; column < headers.length; column += 1) {
            Cell cell = header.createCell(column);
            cell.setCellValue(headers[column]);
            cell.setCellStyle(headerStyle);
        }
        CellStyle body = tableBodyStyle(workbook);
        CellStyle date = dateStyle(workbook);
        for (int index = 0; index < annotations.size(); index += 1) {
            Annotation annotation = annotations.get(index);
            Row row = sheet.createRow(index + 1);
            row.setHeightInPoints(44);
            Object[] values = {index + 1, title, author, typeLabel(annotation.type()), styleLabel(annotation.style()),
                    colorLabel(annotation.color()), annotation.quote(), annotation.note(), annotation.locator()};
            for (int column = 0; column < values.length; column += 1) {
                Cell cell = row.createCell(column);
                if (values[column] instanceof Number number) cell.setCellValue(number.doubleValue());
                else cell.setCellValue(values[column] == null ? "" : values[column].toString());
                cell.setCellStyle(body);
            }
            Cell created = row.createCell(9);
            created.setCellValue(Date.from(annotation.createdAt().toInstant()));
            created.setCellStyle(date);
            Cell updated = row.createCell(10);
            updated.setCellValue(Date.from(annotation.updatedAt().toInstant()));
            updated.setCellStyle(date);
        }
        int[] widths = {8, 24, 18, 14, 12, 12, 58, 48, 34, 20, 20};
        for (int column = 0; column < widths.length; column += 1) sheet.setColumnWidth(column, widths[column] * 256);
        sheet.createFreezePane(0, 1);
        sheet.setAutoFilter(new CellRangeAddress(0, annotations.size(), 0, headers.length - 1));
    }

    private void configurePage(XWPFDocument document) {
        CTSectPr section = document.getDocument().getBody().isSetSectPr()
                ? document.getDocument().getBody().getSectPr() : document.getDocument().getBody().addNewSectPr();
        CTPageSz size = section.isSetPgSz() ? section.getPgSz() : section.addNewPgSz();
        size.setW(BigInteger.valueOf(12_240));
        size.setH(BigInteger.valueOf(15_840));
        CTPageMar margin = section.isSetPgMar() ? section.getPgMar() : section.addNewPgMar();
        margin.setTop(BigInteger.valueOf(1_440));
        margin.setRight(BigInteger.valueOf(1_440));
        margin.setBottom(BigInteger.valueOf(1_440));
        margin.setLeft(BigInteger.valueOf(1_440));
        margin.setHeader(BigInteger.valueOf(708));
        margin.setFooter(BigInteger.valueOf(708));
    }

    private XWPFRun addRun(XWPFParagraph paragraph, String text, int size, String color, boolean bold) {
        XWPFRun run = paragraph.createRun();
        run.setText(text == null ? "" : text);
        run.setFontFamily(CJK_FONT);
        run.setFontFamily(CJK_FONT, XWPFRun.FontCharRange.eastAsia);
        run.setFontSize(size);
        run.setColor(color);
        run.setBold(bold);
        return run;
    }

    private void styleAnnotationRun(XWPFRun run, Annotation annotation) {
        String color = highlightHex(annotation.color());
        if (annotation.style() == AnnotationStyle.BOLD) run.setBold(true);
        if (annotation.style() == AnnotationStyle.UNDERLINE) {
            run.setUnderline(UnderlinePatterns.SINGLE);
            run.setUnderlineColor(color);
        }
        if (annotation.style() == AnnotationStyle.HIGHLIGHT) {
            var properties = run.getCTR().isSetRPr() ? run.getCTR().getRPr() : run.getCTR().addNewRPr();
            var shading = properties.addNewShd();
            shading.setFill(color);
        }
    }

    private XSSFCellStyle titleStyle(XSSFWorkbook workbook) {
        XSSFCellStyle style = workbook.createCellStyle();
        XSSFFont font = workbook.createFont();
        font.setFontName(CJK_FONT);
        font.setFontHeightInPoints((short) 20);
        font.setBold(true);
        font.setColor(new XSSFColor(hex(INK), null));
        style.setFont(font);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setFillForegroundColor(new XSSFColor(hex(PAPER), null));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private XSSFCellStyle summaryLabelStyle(XSSFWorkbook workbook) {
        XSSFCellStyle style = baseCellStyle(workbook, true);
        style.setFillForegroundColor(new XSSFColor(hex("EFE7DB"), null));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private XSSFCellStyle summaryValueStyle(XSSFWorkbook workbook) {
        return baseCellStyle(workbook, false);
    }

    private XSSFCellStyle tableHeaderStyle(XSSFWorkbook workbook) {
        XSSFCellStyle style = baseCellStyle(workbook, true);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setFillForegroundColor(new XSSFColor(hex(PRIMARY), null));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        Font font = workbook.createFont();
        font.setFontName(CJK_FONT);
        font.setFontHeightInPoints((short) 10);
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        return style;
    }

    private XSSFCellStyle tableBodyStyle(XSSFWorkbook workbook) {
        XSSFCellStyle style = baseCellStyle(workbook, false);
        style.setWrapText(true);
        style.setVerticalAlignment(VerticalAlignment.TOP);
        return style;
    }

    private XSSFCellStyle dateStyle(XSSFWorkbook workbook) {
        XSSFCellStyle style = tableBodyStyle(workbook);
        style.setDataFormat(workbook.createDataFormat().getFormat("yyyy-mm-dd hh:mm"));
        return style;
    }

    private XSSFCellStyle baseCellStyle(XSSFWorkbook workbook, boolean bold) {
        XSSFCellStyle style = workbook.createCellStyle();
        XSSFFont font = workbook.createFont();
        font.setFontName(CJK_FONT);
        font.setFontHeightInPoints((short) 10);
        font.setBold(bold);
        font.setColor(new XSSFColor(hex(INK), null));
        style.setFont(font);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setTopBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setRightBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setLeftBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        return style;
    }

    private String label(Annotation annotation) {
        return annotation.type() == AnnotationType.NOTE ? "高亮笔记" : styleLabel(annotation.style());
    }

    private String typeLabel(AnnotationType type) {
        return switch (type) { case NOTE -> "笔记"; case HIGHLIGHT -> "划线"; case BOOKMARK -> "书签"; };
    }

    private String styleLabel(AnnotationStyle style) {
        return switch (style) { case HIGHLIGHT -> "高亮"; case UNDERLINE -> "下划线"; case BOLD -> "加粗"; };
    }

    private String colorLabel(String color) {
        if (color == null) return "黄色";
        return switch (color) {
            case "GREEN", "TEAL" -> "绿色";
            case "PINK" -> "粉色";
            case "BLUE" -> "蓝色";
            case "ORANGE", "CORAL" -> "橙色";
            default -> "黄色";
        };
    }

    private String highlightHex(String color) {
        if (color == null) return "FFF36D";
        return switch (color) {
            case "GREEN", "TEAL" -> "A7F3A1";
            case "PINK" -> "FFB3D1";
            case "BLUE" -> "A9E7FF";
            case "ORANGE", "CORAL" -> "FFC47A";
            default -> "FFF36D";
        };
    }

    private byte[] hex(String value) {
        return new byte[] {(byte) Integer.parseInt(value.substring(0, 2), 16),
                (byte) Integer.parseInt(value.substring(2, 4), 16),
                (byte) Integer.parseInt(value.substring(4, 6), 16)};
    }

    private String sanitizeFilename(String title) {
        String sanitized = title == null ? "未命名书籍" : title.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        return sanitized.isBlank() ? "未命名书籍" : sanitized.substring(0, Math.min(sanitized.length(), 80));
    }

    public enum ExportFormat { DOCX, XLSX }
    public record ExportedFile(String filename, String mediaType, byte[] content) {}
}
