package com.elexvx.bookkin.catalog.terms;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import java.text.Normalizer;

/** Shared validation and normalization rules for searchable metadata terms. */
public final class MetadataTermText {
    public record LanguageValue(String value, String label) {}

    private static final Pattern WHITESPACE = Pattern.compile("(?U)\\s+");
    private static final Pattern LANGUAGE_CODE = Pattern.compile("(?i)^([a-z]{2,3})(?:[-_][a-z0-9]{1,8})*$");
    private static final Map<String, String> LANGUAGE_CODES = languageCodes();
    private static final Map<String, String> KNOWN_LANGUAGE_LABELS = languageLabels();
    private static final Map<String, String> LANGUAGE_ALIASES = languageAliases();

    private MetadataTermText() {}

    public static String clean(String raw, MetadataTermKind kind) {
        if (raw == null) throw invalid(kind);
        String value = raw.strip();
        int max = switch (kind) {
            case LANGUAGE -> 1024;
            case SERIES -> 500;
            case TAG -> 200;
            case KNOWLEDGE -> 60;
        };
        if (value.isEmpty() || value.length() > max || unsafe(value)) throw invalid(kind);
        return value;
    }

    public static String normalizedKey(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFKC).strip();
        normalized = WHITESPACE.matcher(normalized).replaceAll(" ");
        // Java has no direct full Unicode casefold API. Upper/lower handles expanding folds such as ß -> ss.
        return normalized.toUpperCase(Locale.ROOT).toLowerCase(Locale.ROOT);
    }

    public static LanguageValue language(String rawValue, String rawLabel) {
        String label = clean(rawLabel == null || rawLabel.isBlank() ? rawValue : rawLabel, MetadataTermKind.LANGUAGE);
        String candidate = rawValue == null || rawValue.isBlank() ? label : rawValue.strip();
        String code = canonicalLanguageCode(candidate);
        if (code == null) code = LANGUAGE_ALIASES.get(normalizedKey(candidate));
        if (code == null) code = LANGUAGE_ALIASES.get(normalizedKey(label));
        if (code == null) return new LanguageValue(label, label);

        String defaultLabel = KNOWN_LANGUAGE_LABELS.getOrDefault(code, code);
        String selectedLabel = label.equalsIgnoreCase(candidate) || label.equalsIgnoreCase(code) || label.equalsIgnoreCase(defaultLabel)
                ? defaultLabel : label;
        if (code.equals("und")) selectedLabel = defaultLabel;
        return new LanguageValue(code, selectedLabel);
    }

    public static String canonicalLanguageValue(String value) {
        return language(value, value).value();
    }

    public static String displayLanguageLabel(String value, String storedLabel) {
        String canonical = canonicalLanguageCode(value);
        if (canonical == null) return storedLabel == null || storedLabel.isBlank() ? value : storedLabel;
        if (storedLabel == null || storedLabel.isBlank() || normalizedKey(storedLabel).equals(normalizedKey(value))) {
            return KNOWN_LANGUAGE_LABELS.getOrDefault(canonical, value);
        }
        return storedLabel;
    }

    public static List<String> splitLanguages(String serialized) {
        if (serialized == null || serialized.isBlank()) return List.of();
        String[] values = serialized.split("[,，、;；|/\\r\\n]+");
        List<String> result = new ArrayList<>();
        for (String value : values) if (!value.isBlank()) result.add(value.strip());
        return List.copyOf(result);
    }

    private static String canonicalLanguageCode(String raw) {
        if (raw == null) return null;
        String value = Normalizer.normalize(raw.strip().replace('_', '-'), Normalizer.Form.NFKC);
        var matcher = LANGUAGE_CODE.matcher(value);
        if (!matcher.matches()) return null;
        String source = matcher.group(1).toLowerCase(Locale.ROOT);
        String code = LANGUAGE_CODES.get(source);
        return code == null ? null : code;
    }

    private static boolean unsafe(String value) {
        String lower = value.toLowerCase(Locale.ROOT);
        return value.codePoints().anyMatch(Character::isISOControl)
                || value.contains("<") || value.contains(">") || lower.contains("javascript:")
                || lower.contains("<script") || lower.contains("</script");
    }

    private static IllegalArgumentException invalid(MetadataTermKind kind) {
        return new IllegalArgumentException("词条内容无效或超过" + limitDescription(kind) + "字符。");
    }

    private static int limitDescription(MetadataTermKind kind) {
        return switch (kind) {
            case LANGUAGE -> 1024;
            case SERIES -> 500;
            case TAG -> 200;
            case KNOWLEDGE -> 60;
        };
    }

    private static Map<String, String> languageCodes() {
        Map<String, String> result = new HashMap<>();
        for (String code : Locale.getISOLanguages()) {
            String normalizedCode = code.toLowerCase(Locale.ROOT);
            result.put(normalizedCode, normalizedCode);
            Locale locale = Locale.forLanguageTag(normalizedCode);
            try { result.put(locale.getISO3Language().toLowerCase(Locale.ROOT), normalizedCode); }
            catch (Exception ignored) { }
        }
        result.put("und", "und");
        result.put("chi", "zh");
        result.put("cmn", "zh");
        result.put("zho", "zh");
        result.put("eng", "en");
        result.put("nor", "no");
        result.put("nob", "no");
        result.put("nno", "no");
        result.put("fre", "fr");
        result.put("fra", "fr");
        result.put("ger", "de");
        result.put("deu", "de");
        result.put("jpn", "ja");
        result.put("kor", "ko");
        result.put("spa", "es");
        result.put("rus", "ru");
        result.put("por", "pt");
        result.put("ita", "it");
        return Map.copyOf(result);
    }

    private static Map<String, String> languageLabels() {
        Map<String, String> result = new HashMap<>();
        for (String code : Locale.getISOLanguages()) {
            Locale locale = Locale.forLanguageTag(code);
            String label = locale.getDisplayLanguage(Locale.SIMPLIFIED_CHINESE);
            if (label != null && !label.isBlank() && !label.equalsIgnoreCase(code)) {
                result.put(code.toLowerCase(Locale.ROOT), label);
            }
        }
        result.put("zh", "中文");
        result.put("en", "英文");
        result.put("und", "未指定语言");
        return Map.copyOf(result);
    }

    private static Map<String, String> languageAliases() {
        Map<String, String> result = new HashMap<>();
        for (String code : Locale.getISOLanguages()) {
            Locale locale = Locale.forLanguageTag(code);
            result.put(normalizedKey(locale.getDisplayLanguage(Locale.ENGLISH)), code.toLowerCase(Locale.ROOT));
            result.put(normalizedKey(locale.getDisplayLanguage(Locale.SIMPLIFIED_CHINESE)), code.toLowerCase(Locale.ROOT));
        }
        result.putAll(Map.ofEntries(
                Map.entry("中文", "zh"), Map.entry("汉语", "zh"), Map.entry("漢語", "zh"),
                Map.entry("普通话", "zh"), Map.entry("英文", "en"), Map.entry("英语", "en"),
                Map.entry("日语", "ja"), Map.entry("日本語", "ja"), Map.entry("韩语", "ko"),
                Map.entry("한국어", "ko"), Map.entry("法语", "fr"), Map.entry("德语", "de"),
                Map.entry("西班牙语", "es"), Map.entry("俄语", "ru"), Map.entry("葡萄牙语", "pt"),
                Map.entry("意大利语", "it"), Map.entry("挪威语", "no"), Map.entry("未指定语言", "und")));
        return Map.copyOf(result);
    }
}
