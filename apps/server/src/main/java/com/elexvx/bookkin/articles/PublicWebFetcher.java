package com.elexvx.bookkin.articles;

import com.elexvx.bookkin.common.ApiException;
import java.net.*;
import java.io.*;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.SystemDefaultDnsResolver;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.core5.util.Timeout;
import org.springframework.stereotype.Component;

@Component
public class PublicWebFetcher {
    public record Download(byte[] bytes, String mime, String url) {}
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
    public Download get(String input, int limit) {
        try (var client = HttpClients.custom().disableRedirectHandling().disableAutomaticRetries()
            .setConnectionManager(PoolingHttpClientConnectionManagerBuilder.create().setDnsResolver(new SystemDefaultDnsResolver() {
                @Override public InetAddress[] resolve(String host) throws UnknownHostException {
                    var addresses = super.resolve(host);
                    for (var address : addresses) validateAddress(address);
                    return addresses;
                }
            }).build())
            .setDefaultRequestConfig(RequestConfig.custom().setConnectionRequestTimeout(Timeout.ofSeconds(5))
                .setResponseTimeout(Timeout.ofSeconds(12)).build()).build()) {
            String current = input;
            for (int redirects = 0; redirects < 4; redirects++) {
                URI uri = URI.create(current);
                if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                    || uri.getPort() != -1 && uri.getPort() != 443) throw new IOException("Only public HTTPS URLs are allowed");
                final String url = current;
                var request = new HttpGet(uri);
                request.setHeader("User-Agent", "Mozilla/5.0 BookKin/1.0");
                Download result = client.execute(request, response -> {
                    if (response.getCode() >= 300 && response.getCode() < 400) {
                        var location = response.getFirstHeader("Location");
                        if (location == null) throw new IOException("Missing redirect");
                        return new Download(null, "redirect", uri.resolve(location.getValue()).toString());
                    }
                    if (response.getCode() != 200 || response.getEntity() == null) throw new IOException("Page unavailable");
                    try (var stream = response.getEntity().getContent()) {
                        byte[] bytes = stream.readNBytes(limit + 1);
                        if (bytes.length > limit) throw new IOException("Resource too large");
                        return new Download(bytes, response.getEntity().getContentType(), url);
                    }
                });
                if (result.bytes() != null) return result;
                current = result.url();
            }
            throw new IOException("Too many redirects");
        } catch (Exception error) { throw ApiException.badRequest("FETCH_FAILED", "无法抓取该公开 HTTPS 页面或资源，请检查链接，或使用手动导入。"); }
    }
}
