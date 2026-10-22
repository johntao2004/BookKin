package com.elexvx.bookkin.catalog;

import com.elexvx.bookkin.common.ApiException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import tools.jackson.databind.ObjectMapper;

// 上传、编辑与筛选共用的官方 Thema 代码验证；仅含主题代码，不混入限定符。
/** Official subject-code validation shared by ingestion, editing and filters; qualifiers are separate. */
public final class ThemaSubjects {
    private static final Map<String, String> SUBJECTS = load();
    private ThemaSubjects() {}
    private static Map<String, String> load() {
        try (var input = ThemaSubjects.class.getResourceAsStream("/catalog/thema-1.6.json")) {
            var values = new LinkedHashMap<String, String>();
            for (var item : new ObjectMapper().readTree(input).path("subjects")) {
                values.put(item.path("code").asText(), item.path("label").asText());
            }
            return Map.copyOf(values);
        } catch (Exception exception) { throw new ExceptionInInitializerError(exception); }
    }
    public static List<String> validate(List<String> codes) {
        if (codes == null) return List.of();
        if (codes.size() > 4) throw invalid();
        return codes.stream().map(code -> {
            if (code == null || code.length() <= 1 || !SUBJECTS.containsKey(code)) throw invalid();
            return code;
        }).distinct().toList();
    }
    public static String filter(String code) {
        if (code == null || code.isBlank()) return null;
        if (!"UNCLASSIFIED".equals(code) && !SUBJECTS.containsKey(code)) throw invalid();
        return code;
    }
    private static ApiException invalid() { return ApiException.badRequest("INVALID_THEMA_SUBJECT", "请选择有效的 Thema 主题代码，最多四项；主栏目仅用于浏览。"); }
    public static List<String> extract(List<String> codes) {
        return codes == null ? List.of() : codes.stream().map(value -> value.strip().toUpperCase(Locale.ROOT))
                .filter(value -> value.length() > 1 && SUBJECTS.containsKey(value)).distinct().limit(4).toList();
    }
}
