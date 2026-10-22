package com.elexvx.bookkin.articles;

import com.elexvx.bookkin.common.ApiException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;
import java.util.concurrent.TimeoutException;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.core5.http.ClassicHttpResponse;
import org.apache.hc.core5.http.ConnectionRequestTimeoutException;
import org.apache.hc.core5.net.InetAddressUtils;
import org.apache.hc.core5.util.Timeout;
import org.springframework.stereotype.Component;

@Component
public class PublicWebFetcher {
    private static final int MAX_REDIRECTS = 3;
    private static final int CONNECTION_TIMEOUT_SECONDS = 5;
    private static final int RESPONSE_TIMEOUT_SECONDS = 12;

    private static final String URL_INVALID = "链接无效，仅支持通过 HTTPS 访问 443 端口的公开页面。";
    private static final String ADDRESS_BLOCKED = "目标地址不允许访问。";
    private static final String DNS_FAILED = "无法解析目标主机，请检查链接中的域名。";
    private static final String TIMEOUT = "抓取超时，请稍后重试或手动导入。";
    private static final String TOO_LARGE = "页面内容超过允许的抓取大小，请手动导入。";
    private static final String TOO_MANY_REDIRECTS = "页面跳转次数过多，请检查链接。";
    private static final String REDIRECT_INVALID = "页面跳转地址无效。";
    private static final String FETCH_FAILED = "抓取失败，请稍后重试或手动导入。";

    public record Download(byte[] bytes, String mime, String url) {}

    @FunctionalInterface
    interface ClientFactory {
        CloseableHttpClient create();
    }

    private final ClientFactory clientFactory;

    public PublicWebFetcher() {
        this(PublicWebFetcher::createClient);
    }

    PublicWebFetcher(ClientFactory clientFactory) {
        this.clientFactory = clientFactory;
    }

    private static CloseableHttpClient createClient() {
        return HttpClients.custom()
            .disableRedirectHandling()
            .disableAutomaticRetries()
            .setConnectionManager(PoolingHttpClientConnectionManagerBuilder.create()
                .setDnsResolver(new PublicArticleDnsResolver())
                .build())
            .setDefaultRequestConfig(RequestConfig.custom()
                .setConnectionRequestTimeout(Timeout.ofSeconds(CONNECTION_TIMEOUT_SECONDS))
                .setConnectTimeout(Timeout.ofSeconds(CONNECTION_TIMEOUT_SECONDS))
                .setResponseTimeout(Timeout.ofSeconds(RESPONSE_TIMEOUT_SECONDS))
                .build())
            .build();
    }

    public static void validateAddress(InetAddress address) throws UnknownHostException {
        byte[] b = address.getAddress();
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                || address.isSiteLocalAddress() || address.isMulticastAddress()
                || (b.length == 16 && ((b[0] & 0xfe) == 0xfc || b[0] == 0 || (b[0] & 255) == 0x20 && (b[1] & 255) == 1 && b[2] == 0))
                || (b.length == 4 && ((b[0] & 255) == 0 || (b[0] & 255) >= 224
                    || (b[0] & 255) == 100 && (b[1] & 255) >= 64 && (b[1] & 255) <= 127
                    || (b[0] & 255) == 198 && ((b[1] & 255) == 18 || (b[1] & 255) == 19))))
            throw new UnknownHostException("Only public addresses are allowed");
    }

    // 每次跳转重新校验 HTTPS 地址；DNS 结果由连接器校验，响应体按上限流式读取。
    // Revalidate every HTTPS redirect, validate DNS answers in the connection manager, and stream within the byte limit.
    public Download get(String input, int limit) {
        if (limit < 0) throw ApiException.badRequest("FETCH_INVALID_LIMIT", "抓取大小上限无效。");
        String current = input;
        URI uri = requirePublicHttpsUri(current);
        try (var client = clientFactory.create()) {
            for (int redirectCount = 0; ; redirectCount++) {
                String requestUrl = current;
                URI requestUri = uri;
                var request = new HttpGet(requestUri);
                request.setHeader("User-Agent", "Mozilla/5.0 BookKin/1.0");

                Download result = client.execute(request,
                    response -> handleResponse(response, requestUri, requestUrl, limit));
                if (result.bytes() != null) return result;
                if (redirectCount >= MAX_REDIRECTS) {
                    throw ApiException.badRequest("FETCH_TOO_MANY_REDIRECTS", TOO_MANY_REDIRECTS);
                }
                current = result.url();
                uri = requirePublicHttpsUri(current);
            }
        } catch (ApiException failure) {
            throw failure;
        } catch (Exception failure) {
            throw mapFailure(failure);
        }
    }

    private static Download handleResponse(ClassicHttpResponse response, URI uri, String requestUrl, int limit)
            throws IOException {
        int status = response.getCode();
        if (status >= 300 && status < 400) {
            var location = response.getFirstHeader("Location");
            if (location == null || location.getValue() == null || location.getValue().isBlank()) {
                throw ApiException.badRequest("FETCH_REDIRECT_INVALID", REDIRECT_INVALID);
            }
            try {
                return new Download(null, "redirect", uri.resolve(location.getValue()).toString());
            } catch (IllegalArgumentException invalidLocation) {
                throw ApiException.badRequest("FETCH_REDIRECT_INVALID", REDIRECT_INVALID);
            }
        }
        var entity = response.getEntity();
        if (status != 200 || entity == null) {
            throw ApiException.badRequest("FETCH_HTTP_ERROR", httpFailure(status));
        }
        try (InputStream stream = entity.getContent()) {
            byte[] bytes = readBounded(stream, limit);
            return new Download(bytes, entity.getContentType(), requestUrl);
        } catch (ResourceTooLargeException tooLarge) {
            throw ApiException.badRequest("FETCH_RESOURCE_TOO_LARGE", TOO_LARGE);
        }
    }

    private static byte[] readBounded(InputStream stream, int limit) throws IOException {
        var output = new ByteArrayOutputStream(Math.min(limit, 8192));
        byte[] buffer = new byte[8192];
        int total = 0;
        while (total < limit) {
            int read = stream.read(buffer, 0, Math.min(buffer.length, limit - total));
            if (read < 0) return output.toByteArray();
            if (read == 0) continue;
            output.write(buffer, 0, read);
            total += read;
        }
        if (stream.read() != -1) throw new ResourceTooLargeException();
        return output.toByteArray();
    }

    private static URI requirePublicHttpsUri(String value) {
        if (value == null || value.isBlank()) {
            throw ApiException.badRequest("FETCH_URL_INVALID", URL_INVALID);
        }
        try {
            URI uri = URI.create(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                    || uri.getPort() != -1 && uri.getPort() != 443) {
                throw ApiException.badRequest("FETCH_URL_INVALID", URL_INVALID);
            }
            validateLiteralHost(uri.getHost());
            return uri;
        } catch (IllegalArgumentException invalidUri) {
            throw ApiException.badRequest("FETCH_URL_INVALID", URL_INVALID);
        }
    }

    private static void validateLiteralHost(String host) {
        String literal = host;
        boolean ipv6 = host.startsWith("[") && host.endsWith("]");
        if (ipv6) {
            literal = host.substring(1, host.length() - 1);
            if (literal.contains("%")) {
                throw ApiException.badRequest("FETCH_ADDRESS_BLOCKED", ADDRESS_BLOCKED);
            }
        }

        boolean standardIpv4 = !ipv6 && InetAddressUtils.isIPv4Address(literal);
        boolean standardIpv6 = ipv6 && InetAddressUtils.isIPv6Address(literal);
        if (standardIpv4 || standardIpv6) {
            try {
                validateAddress(InetAddress.getByName(literal));
            } catch (UnknownHostException blocked) {
                throw ApiException.badRequest("FETCH_ADDRESS_BLOCKED", ADDRESS_BLOCKED);
            }
            return;
        }
        if (looksLikeNonStandardNumericAddress(literal)) {
            throw ApiException.badRequest("FETCH_URL_INVALID", URL_INVALID);
        }
    }

    private static boolean looksLikeNonStandardNumericAddress(String host) {
        return host.matches("[0-9.]+")
                || host.matches("(?i)(?:0x[0-9a-f]+|[0-9]+)(?:\\.(?:0x[0-9a-f]+|[0-9]+))*");
    }

    private static String httpFailure(int status) {
        return "目标网站返回 HTTP " + status + "，暂时无法抓取。";
    }

    private static ApiException mapFailure(Exception failure) {
        if (hasCause(failure, PublicArticleDnsResolver.BlockedAddressException.class)) {
            return ApiException.badRequest("FETCH_ADDRESS_BLOCKED", ADDRESS_BLOCKED);
        }
        if (hasCause(failure, UnknownHostException.class)) {
            return ApiException.badRequest("FETCH_DNS_FAILED", DNS_FAILED);
        }
        if (hasCause(failure, SocketTimeoutException.class) || hasCause(failure, TimeoutException.class)
                || hasCause(failure, ConnectionRequestTimeoutException.class)) {
            return ApiException.badRequest("FETCH_TIMEOUT", TIMEOUT);
        }
        return ApiException.badRequest("FETCH_FAILED", FETCH_FAILED);
    }

    private static boolean hasCause(Throwable failure, Class<? extends Throwable> type) {
        Set<Throwable> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        for (Throwable current = failure; current != null && seen.add(current); current = current.getCause()) {
            if (type.isInstance(current)) return true;
        }
        return false;
    }

    private static final class ResourceTooLargeException extends IOException {
        private ResourceTooLargeException() {
            super("Response exceeds configured size limit");
        }
    }
}
