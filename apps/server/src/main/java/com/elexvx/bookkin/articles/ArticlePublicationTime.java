package com.elexvx.bookkin.articles;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** 仅从语义明确表示发布时间的字段提取日期；Extracts dates only from fields whose semantics identify publication time. */
final class ArticlePublicationTime {
    private static final Pattern EPOCH = Pattern.compile("\\d{10}|\\d{13}");
    private static final Pattern CHINESE_DATE = Pattern.compile("^(\\d{4})年(\\d{1,2})月(\\d{1,2})日(.*)$");
    private static final Pattern SCRIPT_DATE = Pattern.compile(
            "(?i)(?<![\\w$])(?:['\"](create_time|createTime|ct|publish_time)['\"]|(create_time|createTime|ct|publish_time))\\s*[:=]\\s*(?:\"([^\"\\\\]{1,80})\"|'([^'\\\\]{1,80})'|(\\d{13}|\\d{10})(?!\\d))");
    private static final Pattern SPACE_BEFORE_TIME = Pattern.compile("^(\\d{4}-\\d{2}-\\d{2})\\s+(\\d{2}:\\d{2}.*)$");
    private static final Pattern OFFSET_WITHOUT_COLON = Pattern.compile("([+-]\\d{2})(\\d{2})$");
    private static final Pattern HAS_SECONDS = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}(?:[.,]|Z|[+-]|$).*$", Pattern.CASE_INSENSITIVE);
    private static final DateTimeFormatter LOCAL_MINUTE = DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm", Locale.ROOT);
    private static final DateTimeFormatter LOCAL_SECOND = DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm:ss", Locale.ROOT);
    private static final DateTimeFormatter OFFSET_MINUTE = DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mmXXX", Locale.ROOT);
    private static final DateTimeFormatter OFFSET_SECOND = DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm:ssXXX", Locale.ROOT);
    private static final DateTimeFormatter ZONED_MINUTE = DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mmXXX'['VV']'", Locale.ROOT);
    private static final DateTimeFormatter ZONED_SECOND = DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm:ssXXX'['VV']'", Locale.ROOT);

    private ArticlePublicationTime() {}

    static String extract(Document document, ObjectMapper json) {
        if (document == null) return "";

        String value = fromMeta(document, "article:published_time");
        if (!value.isEmpty()) return value;
        value = fromMeta(document, "datepublished");
        if (!value.isEmpty()) return value;
        value = fromJsonLd(document, json);
        if (!value.isEmpty()) return value;

        Element wechatTime = document.selectFirst("#publish_time");
        if (wechatTime != null) {
            value = firstValid(wechatTime.attr("datetime"), wechatTime.text());
            if (!value.isEmpty()) return value;
        }
        for (Element time : document.select("time[datetime]")) {
            if (isClearlyModified(time)) continue;
            value = normalize(time.attr("datetime"));
            if (!value.isEmpty()) return value;
        }
        return fromScriptVariables(document);
    }

    private static boolean isClearlyModified(Element time) {
        Set<String> markers = Set.of("datemodified", "date_modified", "date-modified", "modified", "updated",
                "lastmodified", "last_modified", "last-modified", "modified-time", "updated-time", "last-updated");
        for (String attribute : List.of("itemprop", "property", "name", "class", "id")) {
            for (String token : time.attr(attribute).toLowerCase(Locale.ROOT).split("[\\s,]+"))
                if (markers.contains(token)) return true;
        }
        return false;
    }

    private static String fromMeta(Document document, String wanted) {
        for (Element meta : document.select("meta[content]")) {
            String key = firstNonBlank(meta.attr("property"), meta.attr("name"), meta.attr("itemprop"));
            if (!key.toLowerCase(Locale.ROOT).equals(wanted)) continue;
            String value = normalize(meta.attr("content"));
            if (!value.isEmpty()) return value;
        }
        return "";
    }

    private static String fromJsonLd(Document document, ObjectMapper json) {
        if (json == null) return "";
        for (Element script : document.select("script[type=application/ld+json]")) {
            String source = script.data();
            if (source.isBlank() || source.length() > 1_000_000) continue;
            try {
                JsonNode root = json.readTree(source);
                Deque<JsonNode> pending = new ArrayDeque<>();
                pending.push(root);
                while (!pending.isEmpty()) {
                    JsonNode node = pending.pop();
                    if (node.isObject()) {
                        if (isSupportedArticleType(node.path("@type"))) {
                            JsonNode date = node.path("datePublished");
                            if (date.isTextual() || date.isNumber()) {
                                String value = normalize(date.asText());
                                if (!value.isEmpty()) return value;
                            }
                        }
                        List<JsonNode> children = new ArrayList<>();
                        node.iterator().forEachRemaining(children::add);
                        for (int i = children.size() - 1; i >= 0; i--) pending.push(children.get(i));
                    } else if (node.isArray()) {
                        List<JsonNode> children = new ArrayList<>();
                        node.iterator().forEachRemaining(children::add);
                        for (int i = children.size() - 1; i >= 0; i--) pending.push(children.get(i));
                    }
                }
            } catch (Exception malformedJsonLd) {
                // 结构化数据无效时继续尝试其他发布时间来源。 Malformed structured data is optional; keep trying other publication sources.
            }
        }
        return "";
    }

    private static boolean isSupportedArticleType(JsonNode type) {
        if (type.isArray()) {
            for (JsonNode item : type) if (item.isTextual() && isSupportedArticleTypeName(item.asText())) return true;
            return false;
        }
        return type.isTextual() && isSupportedArticleTypeName(type.asText());
    }

    private static boolean isSupportedArticleTypeName(String value) {
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        int separator = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('#'));
        if (separator >= 0) normalized = normalized.substring(separator + 1);
        return normalized.equals("article") || normalized.equals("newsarticle") || normalized.equals("blogposting");
    }

    private static String fromScriptVariables(Document document) {
        if (!isWechatPage(document)) return "";
        for (Element script : document.select("script")) {
            Matcher matcher = SCRIPT_DATE.matcher(script.data());
            while (matcher.find()) {
                String candidate = firstNonBlank(matcher.group(3), matcher.group(4), matcher.group(5));
                String value = normalize(candidate);
                if (!value.isEmpty()) return value;
            }
        }
        return "";
    }

    private static boolean isWechatPage(Document document) {
        try {
            return "mp.weixin.qq.com".equalsIgnoreCase(java.net.URI.create(document.baseUri()).getHost());
        } catch (IllegalArgumentException invalidBaseUri) {
            return false;
        }
    }

    private static String firstValid(String... candidates) {
        for (String candidate : candidates) {
            String value = normalize(candidate);
            if (!value.isEmpty()) return value;
        }
        return "";
    }

    private static String firstNonBlank(String... candidates) {
        for (String candidate : candidates) if (candidate != null && !candidate.isBlank()) return candidate;
        return "";
    }

    private static String normalize(String raw) {
        if (raw == null) return "";
        String value = raw.trim();
        if (value.isEmpty() || value.length() > 128) return "";

        try {
            if (EPOCH.matcher(value).matches()) {
                long epoch = Long.parseLong(value);
                Instant instant = value.length() == 13 ? Instant.ofEpochMilli(epoch) : Instant.ofEpochSecond(epoch);
                return format(instant.atOffset(ZoneOffset.UTC), true);
            }

            String dateText = value;
            Matcher chineseDate = CHINESE_DATE.matcher(dateText);
            if (chineseDate.matches()) dateText = String.format(Locale.ROOT, "%s-%02d-%02d%s",
                    chineseDate.group(1), Integer.parseInt(chineseDate.group(2)), Integer.parseInt(chineseDate.group(3)), chineseDate.group(4));
            if (dateText.matches("\\d{4}-\\d{2}-\\d{2}"))
                return LocalDate.parse(dateText, DateTimeFormatter.ISO_LOCAL_DATE).toString();

            Matcher spaced = SPACE_BEFORE_TIME.matcher(dateText);
            if (spaced.matches()) dateText = spaced.group(1) + "T" + spaced.group(2).trim();
            dateText = OFFSET_WITHOUT_COLON.matcher(dateText).replaceFirst("$1:$2");
            boolean seconds = HAS_SECONDS.matcher(dateText).matches();

            try {
                ZonedDateTime zoned = ZonedDateTime.parse(dateText, DateTimeFormatter.ISO_ZONED_DATE_TIME);
                return format(zoned, seconds);
            } catch (DateTimeParseException ignored) {}
            try {
                OffsetDateTime offset = OffsetDateTime.parse(dateText, DateTimeFormatter.ISO_OFFSET_DATE_TIME);
                return format(offset, seconds);
            } catch (DateTimeParseException ignored) {}
            try {
                return format(OffsetDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME), true);
            } catch (DateTimeParseException ignored) {}
            try {
                return format(LocalDateTime.parse(dateText, DateTimeFormatter.ISO_LOCAL_DATE_TIME), seconds);
            } catch (DateTimeParseException ignored) {}
            return "";
        } catch (DateTimeException | NumberFormatException invalidDate) {
            return "";
        }
    }

    private static String format(OffsetDateTime dateTime, boolean seconds) {
        return dateTime.format(seconds ? OFFSET_SECOND : OFFSET_MINUTE);
    }

    private static String format(ZonedDateTime dateTime, boolean seconds) {
        DateTimeFormatter formatter = dateTime.getZone() instanceof ZoneOffset
                ? (seconds ? OFFSET_SECOND : OFFSET_MINUTE)
                : (seconds ? ZONED_SECOND : ZONED_MINUTE);
        return dateTime.format(formatter);
    }

    private static String format(LocalDateTime dateTime, boolean seconds) {
        return dateTime.format(seconds ? LOCAL_SECOND : LOCAL_MINUTE);
    }
}
