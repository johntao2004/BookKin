package com.elexvx.bookkin.articles;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.elexvx.bookkin.common.ApiException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.core5.http.ClassicHttpRequest;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.io.HttpClientResponseHandler;
import org.apache.hc.core5.http.io.entity.BasicHttpEntity;
import org.apache.hc.core5.http.message.BasicClassicHttpResponse;
import org.junit.jupiter.api.Test;

class PublicWebFetcherTest {
    private static final String PUBLIC_URL = "https://example.test/article";

    @Test
    void rejectsInvalidUrlWithoutOpeningAClient() {
        var created = new AtomicInteger();
        var fetcher = new PublicWebFetcher(() -> {
            created.incrementAndGet();
            return mock(CloseableHttpClient.class);
        });

        ApiException error = assertThrows(ApiException.class, () -> fetcher.get("http://example.test/page", 100));

        assertEquals("FETCH_URL_INVALID", error.code());
        assertEquals(0, created.get());

        ApiException nullUrl = assertThrows(ApiException.class, () -> fetcher.get(null, 100));
        assertEquals("FETCH_URL_INVALID", nullUrl.code());
    }

    @Test
    void rejectsHttpRedirectBeforeRequestingItsTarget() throws Exception {
        var client = mock(CloseableHttpClient.class);
        stubResponses(client, request -> response(302, "http://127.0.0.1/private", null));
        var fetcher = new PublicWebFetcher(() -> client);

        ApiException error = assertThrows(ApiException.class, () -> fetcher.get(PUBLIC_URL, 100));

        assertEquals("FETCH_URL_INVALID", error.code());
        verify(client, times(1)).execute(any(ClassicHttpRequest.class), any(HttpClientResponseHandler.class));
    }

    @Test
    void rejectsPrivateLiteralRedirectBeforeOpeningItsConnection() throws Exception {
        var client = mock(CloseableHttpClient.class);
        stubResponses(client, request -> response(302, "https://198.18.0.1/private", null));
        var fetcher = new PublicWebFetcher(() -> client);

        ApiException error = assertThrows(ApiException.class, () -> fetcher.get(PUBLIC_URL, 100));

        assertEquals("FETCH_ADDRESS_BLOCKED", error.code());
        verify(client, times(1)).execute(any(ClassicHttpRequest.class), any(HttpClientResponseHandler.class));
    }

    @Test
    void mapsBlockedDnsResolverFailureToItsOwnStableCode() throws Exception {
        var client = mock(CloseableHttpClient.class);
        stubResponses(client, request -> { throw new PublicArticleDnsResolver.BlockedAddressException(); });

        ApiException error = assertThrows(ApiException.class,
            () -> new PublicWebFetcher(() -> client).get(PUBLIC_URL, 100));

        assertEquals("FETCH_ADDRESS_BLOCKED", error.code());
        assertFalse(error.getMessage().contains("Only public addresses"));
    }

    @Test
    void rejectsNonCanonicalNumericAddressBeforeOpeningItsConnection() throws Exception {
        var client = mock(CloseableHttpClient.class);

        ApiException error = assertThrows(ApiException.class,
            () -> new PublicWebFetcher(() -> client).get("https://2130706433/", 100));

        assertEquals("FETCH_URL_INVALID", error.code());
        verify(client, times(0)).execute(any(ClassicHttpRequest.class), any(HttpClientResponseHandler.class));
    }

    @Test
    void reportsDnsFailureAndTimeoutWithStableMessages() throws Exception {
        var dnsClient = mock(CloseableHttpClient.class);
        stubResponses(dnsClient, request -> { throw new UnknownHostException("internal host details"); });
        ApiException dnsError = assertThrows(ApiException.class,
            () -> new PublicWebFetcher(() -> dnsClient).get(PUBLIC_URL, 100));
        assertEquals("FETCH_DNS_FAILED", dnsError.code());
        assertFalse(dnsError.getMessage().contains("internal"));

        var timeoutClient = mock(CloseableHttpClient.class);
        stubResponses(timeoutClient, request -> { throw new SocketTimeoutException("token=secret"); });
        ApiException timeoutError = assertThrows(ApiException.class,
            () -> new PublicWebFetcher(() -> timeoutClient).get(PUBLIC_URL + "?token=secret", 100));
        assertEquals("FETCH_TIMEOUT", timeoutError.code());
        assertFalse(timeoutError.getMessage().contains("secret"));
    }

    @Test
    void reportsHttpFailureWithoutReturningRemoteBody() throws Exception {
        var client = mock(CloseableHttpClient.class);
        stubResponses(client, request -> response(503, null, "internal response".getBytes(StandardCharsets.UTF_8)));

        ApiException error = assertThrows(ApiException.class,
            () -> new PublicWebFetcher(() -> client).get(PUBLIC_URL, 100));

        assertEquals("FETCH_HTTP_ERROR", error.code());
        assertEquals("目标网站返回 HTTP 503，暂时无法抓取。", error.getMessage());
        assertFalse(error.getMessage().contains("internal response"));
    }

    @Test
    void rejectsOversizedBodyAfterReadingOnlyOneByteBeyondTheLimit() throws Exception {
        byte[] body = new byte[100];
        var stream = new CountingInputStream(body);
        var client = mock(CloseableHttpClient.class);
        stubResponses(client, request -> streamResponse(200, null, stream));
        var fetcher = new PublicWebFetcher(() -> client);

        ApiException error = assertThrows(ApiException.class, () -> fetcher.get(PUBLIC_URL, 24));

        assertEquals("FETCH_RESOURCE_TOO_LARGE", error.code());
        assertEquals(25, stream.bytesRead);
    }

    @Test
    void acceptsBodyAtLimitAndPreservesItsMimeAndRequestedUrl() throws Exception {
        byte[] body = "bookkin".getBytes(StandardCharsets.UTF_8);
        var client = mock(CloseableHttpClient.class);
        stubResponses(client, request -> streamResponse(200, null, new ByteArrayInputStream(body)));

        PublicWebFetcher.Download result = new PublicWebFetcher(() -> client).get(PUBLIC_URL, body.length);

        assertArrayEquals(body, result.bytes());
        assertEquals("text/html; charset=UTF-8", result.mime());
        assertEquals(PUBLIC_URL, result.url());
    }

    @Test
    void stopsAfterThreeRedirectsWithAnExplicitError() throws Exception {
        var client = mock(CloseableHttpClient.class);
        var requests = new AtomicInteger();
        stubResponses(client, request -> {
            requests.incrementAndGet();
            return response(302, "/next", null);
        });

        ApiException error = assertThrows(ApiException.class,
            () -> new PublicWebFetcher(() -> client).get(PUBLIC_URL, 100));

        assertEquals("FETCH_TOO_MANY_REDIRECTS", error.code());
        assertEquals(4, requests.get());
    }

    private static void stubResponses(CloseableHttpClient client, Responder responder) throws Exception {
        doAnswer(invocation -> {
            HttpGet request = invocation.getArgument(0);
            @SuppressWarnings("unchecked")
            HttpClientResponseHandler<PublicWebFetcher.Download> handler = invocation.getArgument(1);
            try (var response = responder.respond(request)) {
                return handler.handleResponse(response);
            }
        }).when(client).execute(any(ClassicHttpRequest.class), any(HttpClientResponseHandler.class));
    }

    private static BasicClassicHttpResponse response(int status, String location, byte[] body) {
        return streamResponse(status, location, new ByteArrayInputStream(body == null ? new byte[0] : body));
    }

    private static BasicClassicHttpResponse streamResponse(int status, String location, java.io.InputStream body) {
        var response = new BasicClassicHttpResponse(status);
        if (location != null) response.addHeader("Location", location);
        if (status == 200) {
            response.setEntity(new BasicHttpEntity(body, ContentType.TEXT_HTML));
        }
        return response;
    }

    @FunctionalInterface
    private interface Responder {
        BasicClassicHttpResponse respond(HttpGet request) throws IOException;
    }

    private static final class CountingInputStream extends ByteArrayInputStream {
        private int bytesRead;

        private CountingInputStream(byte[] bytes) {
            super(bytes);
        }

        @Override
        public synchronized int read() {
            int value = super.read();
            if (value >= 0) bytesRead++;
            return value;
        }

        @Override
        public synchronized int read(byte[] bytes, int offset, int length) {
            int count = super.read(bytes, offset, length);
            if (count > 0) bytesRead += count;
            return count;
        }
    }
}
