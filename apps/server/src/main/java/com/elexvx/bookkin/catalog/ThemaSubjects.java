package com.elexvx.bookkin.catalog;

import com.elexvx.bookkin.common.ApiException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import tools.jackson.databind.ObjectMapper;

// 上传、编辑与筛选共用的官方 Thema 代码验证；仅含主题代码，不混入限定符。
/** Official subject-code validation shared by ingestion, editing and filters; qualifiers are separate. */
public final class ThemaSubjects {
    private static final List<Subject> CATALOG = load();
    private static final Map<String, String> SUBJECTS = CATALOG.stream().collect(
            java.util.stream.Collectors.toUnmodifiableMap(Subject::code, Subject::label));
    private ThemaSubjects() {}
    private static List<Subject> load() {
        try (var input = ThemaSubjects.class.getResourceAsStream("/catalog/thema-1.6.json")) {
            var values = new java.util.ArrayList<Subject>();
            for (var item : new ObjectMapper().readTree(input).path("subjects")) {
                String parent = item.path("parent").isTextual() ? item.path("parent").asText() : null;
                values.add(new Subject(item.path("code").asText(), item.path("label").asText(), parent));
            }
            return List.copyOf(values);
        } catch (Exception exception) { throw new ExceptionInInitializerError(exception); }
    }
    /** Canonical Thema labels and parent links. The returned catalog is immutable. */
    public static List<Subject> catalog() { return CATALOG; }
    /** The root categories used to keep AI classification prompts bounded. */
    public static List<Subject> roots() { return CATALOG.stream().filter(subject -> subject.parent() == null).toList(); }
    /** Canonical non-root entries whose first-level category is one of the supplied root codes. */
    public static List<Subject> underRoots(List<String> rootCodes) {
        if (rootCodes == null || rootCodes.isEmpty()) return List.of();
        var roots = roots().stream().map(Subject::code).collect(java.util.stream.Collectors.toSet());
        var selected = rootCodes.stream().filter(roots::contains).collect(java.util.stream.Collectors.toSet());
        if (selected.isEmpty()) return List.of();
        return CATALOG.stream().filter(subject -> subject.code().length() > 1
                && selected.contains(subject.code().substring(0, 1))).toList();
    }
    public record Subject(String code, String label, String parent) {}
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
