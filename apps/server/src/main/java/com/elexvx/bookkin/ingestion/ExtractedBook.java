package com.elexvx.bookkin.ingestion;

import java.math.BigDecimal;
import java.util.List;

// 规范化提取结果中的空字符串与人员列表，确保后续入库拥有标题和作者回退值。
// Normalizes blank strings and contributor lists so ingestion receives title/author fallback values.
public record ExtractedBook(
        String title,
        String subtitle,
        List<String> authors,
        List<String> translators,
        String description,
        String language,
        String publisher,
        String publishedDate,
        String isbn,
        String series,
        BigDecimal seriesIndex,
        List<String> tags,
        String coverCacheKey,
        Integer pageCount,
        Long wordCount) {

    public ExtractedBook {
        title = title == null || title.isBlank() ? "未命名藏书" : title.strip();
        authors = clean(authors).isEmpty() ? List.of("未知作者") : clean(authors);
        translators = clean(translators);
        tags = clean(tags);
        subtitle = blankToNull(subtitle);
        description = blankToNull(description);
        language = blankToNull(language);
        publisher = blankToNull(publisher);
        publishedDate = blankToNull(publishedDate);
        isbn = blankToNull(isbn);
        series = blankToNull(series);
    }

    public String author() {
        return String.join(" / ", authors);
    }

    private static List<String> clean(List<String> values) {
        return values == null ? List.of() : values.stream()
                .filter(value -> value != null && !value.isBlank()).map(String::strip).distinct().toList();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
