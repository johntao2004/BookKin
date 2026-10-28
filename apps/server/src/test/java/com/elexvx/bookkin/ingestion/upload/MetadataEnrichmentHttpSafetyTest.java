package com.elexvx.bookkin.ingestion.upload;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpHeaders;
import java.net.http.HttpResponse;
import java.util.OptionalLong;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class MetadataEnrichmentHttpSafetyTest {
    private static final int MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

    @Test
    void acceptsOnlyHttpsRequestsToFixedBibliographyHosts() {
        assertEquals(URI.create("https://openlibrary.org/search.json?q=example"),
                MetadataEnrichmentService.validateProviderUri("https://openlibrary.org/search.json?q=example"));
        assertEquals(URI.create("https://www.googleapis.com/books/v1/volumes?q=example"),
                MetadataEnrichmentService.validateProviderUri("https://www.googleapis.com/books/v1/volumes?q=example"));
        assertThrows(IllegalArgumentException.class, () ->
                MetadataEnrichmentService.validateProviderUri("https://openlibrary.org.attacker.example/search.json"));
        assertThrows(IllegalArgumentException.class, () ->
                MetadataEnrichmentService.validateProviderUri("http://openlibrary.org/search.json"));
        assertThrows(IllegalArgumentException.class, () ->
                MetadataEnrichmentService.validateProviderUri("https://user@openlibrary.org/search.json"));
        assertThrows(IllegalArgumentException.class, () ->
                MetadataEnrichmentService.validateProviderUri("https://www.googleapis.com:444/books/v1/volumes"));
    }

    @Test
    void rejectsRedirectsAndBoundsBothDeclaredAndStreamingResponseSizes() throws Exception {
        URI requestUri = URI.create("https://openlibrary.org/search.json?q=example");
        var json = new JsonMapper();

        HttpResponse<InputStream> redirect = response(302, requestUri,
                new ByteArrayInputStream(new byte[0]), OptionalLong.empty());
        assertThrows(IllegalStateException.class, () ->
                MetadataEnrichmentService.readJsonResponse(requestUri, redirect, json));
        HttpResponse<InputStream> followedRedirect = response(200, URI.create("https://www.googleapis.com/books/v1/volumes"),
                new ByteArrayInputStream("{}".getBytes(java.nio.charset.StandardCharsets.UTF_8)), OptionalLong.of(2));
        assertThrows(IllegalStateException.class, () ->
                MetadataEnrichmentService.readJsonResponse(requestUri, followedRedirect, json));

        HttpResponse<InputStream> oversizedHeader = response(200, requestUri,
                new ByteArrayInputStream(new byte[0]), OptionalLong.of(MAX_RESPONSE_BYTES + 1L));
        assertThrows(IllegalStateException.class, () ->
                MetadataEnrichmentService.readJsonResponse(requestUri, oversizedHeader, json));

        byte[] atLimit = MetadataEnrichmentService.readBounded(new ByteArrayInputStream(new byte[MAX_RESPONSE_BYTES]));
        assertEquals(MAX_RESPONSE_BYTES, atLimit.length);
        assertThrows(java.io.IOException.class, () -> MetadataEnrichmentService.readBounded(
                new ByteArrayInputStream(new byte[MAX_RESPONSE_BYTES + 1])));
    }

    @SuppressWarnings("unchecked")
    private HttpResponse<InputStream> response(int status, URI uri, InputStream body, OptionalLong contentLength) {
        HttpResponse<InputStream> response = mock(HttpResponse.class);
        HttpHeaders headers = mock(HttpHeaders.class);
        when(response.statusCode()).thenReturn(status);
        when(response.uri()).thenReturn(uri);
        when(response.body()).thenReturn(body);
        when(response.headers()).thenReturn(headers);
        when(headers.firstValueAsLong("content-length")).thenReturn(contentLength);
        return response;
    }
}
