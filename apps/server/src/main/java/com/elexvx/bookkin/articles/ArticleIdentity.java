package com.elexvx.bookkin.articles;

import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;
import java.util.function.Function;
import org.jsoup.Jsoup;

/** Stable identities for imports; titles alone are never evidence of a duplicate. */
final class ArticleIdentity {
    private static final Set<String> TRACKING = Set.of("fbclid", "gclid", "spm");
    private static final Set<String> WECHAT_ID = Set.of("__biz", "mid", "idx", "sn");

    private ArticleIdentity() {}

    static String sourceKey(String value) {
        if (value == null || value.isBlank()) return "";
        try {
            URI uri = URI.create(value.trim()).normalize();
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!Set.of("http", "https").contains(scheme) || uri.getHost() == null || uri.getUserInfo() != null) return "";
            String host = uri.getHost().toLowerCase(Locale.ROOT);
            int port = uri.getPort();
            String path = uri.getRawPath();
            if (path == null || path.isEmpty()) path = "/";
            var parameters = new java.util.ArrayList<String>();
            boolean wechat = host.equals("mp.weixin.qq.com") && path.equals("/s")
                    && uri.getRawQuery() != null && uri.getRawQuery().contains("__biz=") && uri.getRawQuery().contains("mid=");
            boolean wechatShortLink = host.equals("mp.weixin.qq.com") && path.startsWith("/s/") && path.length() > 3;
            if (uri.getRawQuery() != null) for (String part : uri.getRawQuery().split("&")) {
                if (part.isEmpty()) continue;
                String[] pair = part.split("=", 2);
                String name = URLDecoder.decode(pair[0], StandardCharsets.UTF_8);
                String lower = name.toLowerCase(Locale.ROOT);
                if (wechatShortLink || (wechat ? !WECHAT_ID.contains(name) : lower.startsWith("utm_") || TRACKING.contains(lower))) continue;
                parameters.add(URLEncoder.encode(name, StandardCharsets.UTF_8) + (pair.length == 1 ? "" : "="
                        + URLEncoder.encode(URLDecoder.decode(pair[1], StandardCharsets.UTF_8), StandardCharsets.UTF_8)));
            }
            parameters.sort(String::compareTo);
            String canonical = scheme + "://" + host + (port < 0 || scheme.equals("https") && port == 443
                    || scheme.equals("http") && port == 80 ? "" : ":" + port) + path
                    + (parameters.isEmpty() ? "" : "?" + String.join("&", parameters));
            return hash(canonical.getBytes(StandardCharsets.UTF_8));
        } catch (IllegalArgumentException invalid) {
            return "";
        }
    }

    static String contentKey(String html, Function<String, String> imageIdentity) {
        var body = Jsoup.parseBodyFragment(html == null ? "" : html).body();
        body.select("script,style,noscript,template").remove();
        String text = Normalizer.normalize(body.text(), Normalizer.Form.NFC).replaceAll("[\\s\\p{Z}]+", " ").trim();
        var content = new StringBuilder(text);
        for (var image : body.select("img[src]")) content.append('\0').append("image:").append(imageIdentity.apply(image.attr("src")));
        return content.isEmpty() ? "" : hash(content.toString().getBytes(StandardCharsets.UTF_8));
    }

    static String hash(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
