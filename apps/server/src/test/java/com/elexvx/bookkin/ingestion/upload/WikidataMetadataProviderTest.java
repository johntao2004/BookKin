package com.elexvx.bookkin.ingestion.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.ingestion.upload.BookUploadModels.MetadataCandidate;
import com.elexvx.bookkin.ingestion.upload.BookUploadModels.MetadataDraft;
import com.elexvx.bookkin.ingestion.upload.BookUploadModels.MetadataSource;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import javax.net.ssl.SSLSession;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class WikidataMetadataProviderTest {
    private static final String ISBN13 = "9780306406157";
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void isbnSearchResolvesBookClaimsAndBatchesMultiValueEntityLabels() throws Exception {
        var uploads = mock(BookUploadRepository.class);
        var http = mock(HttpClient.class);
        when(uploads.cached(anyString(), anyString())).thenReturn(null);
        when(http.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any())).thenAnswer(invocation -> {
            HttpRequest request = invocation.getArgument(0);
            String rawQuery = request.uri().getRawQuery();
            String body;
            if (request.uri().getHost().equals("query.wikidata.org")) {
                body = """
                        {"results":{"bindings":[
                          {"item":{"value":"http://www.wikidata.org/entity/Q123"}},
                          {"item":{"value":"http://www.wikidata.org/entity/Q124"}}
                        ]}}
                        """;
            } else if (rawQuery.contains("ids=Q123%7CQ124")) {
                body = primaryEntities();
            } else if (rawQuery.contains("ids=Q100%7CQ101%7CQ200%7CQ300%7CQ400")) {
                body = referenceEntities();
            } else {
                throw new AssertionError("Unexpected Wikidata request: " + request.uri());
            }
            return response(request, 200, body);
        });
        var provider = new WikidataMetadataProvider(uploads, json, http);

        List<MetadataCandidate> candidates = provider.search(draft(ISBN13), true);

        assertThat(candidates).hasSize(1);
        MetadataCandidate candidate = candidates.getFirst();
        assertThat(candidate.id()).isEqualTo("wikidata:Q123");
        assertThat(candidate.provider()).isEqualTo(MetadataSource.WIKIDATA);
        assertThat(candidate.title()).isEqualTo("书籍版本");
        assertThat(candidate.authors()).containsExactly("作者甲", "Author B");
        assertThat(candidate.publisher()).isEqualTo("出版社");
        assertThat(candidate.publishedDate()).isEqualTo("2021-03-15");
        assertThat(candidate.isbn()).isEqualTo(ISBN13);
        assertThat(candidate.edition()).isEqualTo("2");
        assertThat(candidate.language()).isEqualTo("英语");
        assertThat(candidate.tags()).containsExactly("生态学");
        assertThat(candidate.coverUrl()).isNull();
        assertThat(candidate.requiresReview()).isTrue();
        assertThat(candidate.sourceUrl()).isEqualTo("https://www.wikidata.org/wiki/Q123");
        verify(http, times(3)).send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any());
        verify(uploads).cache(org.mockito.ArgumentMatchers.eq("WIKIDATA"), org.mockito.ArgumentMatchers.startsWith("sha256:"),
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void refreshSkipsCacheReadAndNormalSearchUsesCachedCandidates() throws Exception {
        var uploads = mock(BookUploadRepository.class);
        var http = mock(HttpClient.class);
        MetadataCandidate cached = new MetadataCandidate("wikidata:Q9", MetadataSource.WIKIDATA, "Wikidata",
                "缓存书目", null, List.of(), null, null, null, null, List.of(), null,
                null, null, true, null, null, "https://www.wikidata.org/wiki/Q9");
        AtomicInteger cacheReads = new AtomicInteger();
        String cachedJson = json.writeValueAsString(List.of(cached));
        when(uploads.cached(org.mockito.ArgumentMatchers.eq("WIKIDATA"), anyString()))
                .thenAnswer(invocation -> cacheReads.getAndIncrement() == 0 ? cachedJson : null);
        when(http.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any())).thenAnswer(invocation -> {
            HttpRequest request = invocation.getArgument(0);
            String rawQuery = request.uri().getRawQuery();
            String body = request.uri().getHost().equals("query.wikidata.org")
                    ? "{\"results\":{\"bindings\":[{\"item\":{\"value\":\"http://www.wikidata.org/entity/Q123\"}}]}}"
                    : rawQuery.contains("ids=Q123") ? primaryEntities() : referenceEntities();
            return response(request, 200, body);
        });
        var provider = new WikidataMetadataProvider(uploads, json, http);

        assertThat(provider.search(draft(ISBN13), false)).extracting(MetadataCandidate::id).containsExactly("wikidata:Q9");
        assertThat(provider.search(draft(ISBN13), true)).extracting(MetadataCandidate::id).containsExactly("wikidata:Q123");
        verify(http, times(3)).send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any());
    }

    @Test
    void rateLimitAndRedirectResponsesReturnNoCandidatesWithoutRetrying() throws Exception {
        for (int status : List.of(429, 302)) {
            var uploads = mock(BookUploadRepository.class);
            var http = mock(HttpClient.class);
            when(uploads.cached(anyString(), anyString())).thenReturn(null);
            when(http.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any())).thenAnswer(invocation ->
                    response(invocation.getArgument(0), status, "{}"));
            var provider = new WikidataMetadataProvider(uploads, json, http);

            var result = provider.searchWithErrors(draft(ISBN13), true);
            assertThat(result.candidates()).isEmpty();
            assertThat(result.errorDetail()).isNotBlank();
            verify(http, times(status == 429 ? 1 : 2)).send(any(HttpRequest.class),
                    org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any());
        }
    }

    @Test
    void timeoutReturnsSafeActionableErrorInsteadOfLookingLikeNoMatch() throws Exception {
        var uploads = mock(BookUploadRepository.class);
        var http = mock(HttpClient.class);
        when(uploads.cached(anyString(), anyString())).thenReturn(null);
        when(http.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any()))
                .thenThrow(new HttpTimeoutException("private host and response details"));
        var provider = new WikidataMetadataProvider(uploads, json, http);

        var result = provider.searchWithErrors(draft(ISBN13), true);

        assertThat(result.candidates()).isEmpty();
        assertThat(result.errorDetail()).contains("超时", "稍后重试").doesNotContain("private host");
    }

    @Test
    void partialLookupFailurePreservesCandidatesAndReportsRetryableError() throws Exception {
        var uploads = mock(BookUploadRepository.class);
        var http = mock(HttpClient.class);
        when(uploads.cached(anyString(), anyString())).thenReturn(null);
        when(http.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any())).thenAnswer(invocation -> {
            HttpRequest request = invocation.getArgument(0);
            String rawQuery = request.uri().getRawQuery();
            if (request.uri().getHost().equals("query.wikidata.org")) {
                return response(request, 200, "{\"results\":{\"bindings\":[{\"item\":{\"value\":\"http://www.wikidata.org/entity/Q123\"}}]}} ");
            }
            if (rawQuery.contains("ids=Q123")) return response(request, 200, primaryEntities());
            return response(request, 429, "{}");
        });
        var provider = new WikidataMetadataProvider(uploads, json, http);

        var result = provider.searchWithErrors(draft(ISBN13), true);

        assertThat(result.candidates()).extracting(MetadataCandidate::id).contains("wikidata:Q123");
        assertThat(result.errorDetail()).contains("限制", "候选仍可选择");
        verify(http, times(3)).send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any());
    }

    private MetadataDraft draft(String isbn) {
        return new MetadataDraft("书籍版本", null, List.of("作者甲"), List.of(), "zh", null, null, isbn,
                null, null, null, List.of(), null, null, Map.of(), "作者甲/书籍版本.epub");
    }

    private String primaryEntities() {
        return """
                {"entities":{
                  "Q123":{"id":"Q123","labels":{"zh":{"value":"书籍版本"},"en":{"value":"Book Edition"}},"claims":{
                    "P31":[%s],
                    "P50":[%s,%s],
                    "P123":[%s],
                    "P407":[%s],
                    "P921":[%s],
                    "P212":[%s],
                    "P957":[%s],
                    "P393":[%s],
                    "P577":[%s]
                  }},
                  "Q124":{"id":"Q124","labels":{"en":{"value":"A human"}},"claims":{"P31":[%s]}}
                }}
                """.formatted(item("Q3331189"), item("Q100"), item("Q101"), item("Q200"), item("Q300"), item("Q400"),
                string("9780306406157"), string("0306406152"), string("2"), date("+2021-03-15T00:00:00Z", 11), item("Q5"));
    }

    private String referenceEntities() {
        return """
                {"entities":{
                  "Q100":{"labels":{"zh":{"value":"作者甲"},"en":{"value":"Author A"}}},
                  "Q101":{"labels":{"en":{"value":"Author B"}}},
                  "Q200":{"labels":{"zh":{"value":"出版社"}}},
                  "Q300":{"labels":{"zh":{"value":"英语"}}},
                  "Q400":{"labels":{"zh":{"value":"生态学"}}}
                }}
                """;
    }

    private String item(String id) {
        return "{\"mainsnak\":{\"snaktype\":\"value\",\"datavalue\":{\"value\":{\"id\":\"" + id
                + "\"}}},\"rank\":\"normal\"}";
    }

    private String string(String value) {
        return "{\"mainsnak\":{\"snaktype\":\"value\",\"datavalue\":{\"value\":\"" + value
                + "\"}},\"rank\":\"normal\"}";
    }

    private String date(String value, int precision) {
        return "{\"mainsnak\":{\"snaktype\":\"value\",\"datavalue\":{\"value\":{\"time\":\"" + value
                + "\",\"precision\":" + precision + "}}},\"rank\":\"normal\"}";
    }

    private HttpResponse<InputStream> response(HttpRequest request, int status, String body) {
        return new TestResponse<>(status, request, new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)),
                HttpHeaders.of(Map.of(), (name, value) -> true));
    }

    private record TestResponse<T>(int statusCode, HttpRequest request, T body, HttpHeaders headers) implements HttpResponse<T> {
        @Override public Optional<HttpResponse<T>> previousResponse() { return Optional.empty(); }
        @Override public Optional<SSLSession> sslSession() { return Optional.empty(); }
        @Override public java.net.URI uri() { return request.uri(); }
        @Override public HttpClient.Version version() { return HttpClient.Version.HTTP_1_1; }
    }
}
