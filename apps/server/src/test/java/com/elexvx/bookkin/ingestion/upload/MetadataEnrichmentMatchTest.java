package com.elexvx.bookkin.ingestion.upload;

import static com.elexvx.bookkin.ingestion.upload.BookUploadModels.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.config.BookKinProperties;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class MetadataEnrichmentMatchTest {
    @Test
    void legacyEnrichmentUsesLiveProviderSettingsAndCanFillFromWikidata() {
        var json = new JsonMapper();
        var uploads = mock(BookUploadRepository.class);
        var ai = mock(AiMetadataService.class);
        var settings = mock(MetadataProviderSettingsService.class);
        var wikidata = mock(WikidataMetadataProvider.class);
        when(settings.isEnabled(MetadataSource.OPEN_LIBRARY)).thenReturn(false);
        when(settings.isEnabled(MetadataSource.GOOGLE_BOOKS)).thenReturn(false);
        when(settings.isEnabled(MetadataSource.WIKIDATA)).thenReturn(true);
        var draft = new MetadataDraft("The Example", null, List.of("An Author"), List.of(), "en", null, null,
                null, null, null, null, List.of(), null, null, Map.of(), "An Author/The Example.epub");
        var wikidataCandidate = new MetadataCandidate("wikidata:Q42", MetadataSource.WIKIDATA, "The Example", null,
                List.of("An Author"), "Example Press", "2014", "9780000000042", null, List.of(), null);
        when(wikidata.searchWithErrors(draft, false))
                .thenReturn(new WikidataMetadataProvider.SearchResult(List.of(wikidataCandidate), null));
        var properties = new BookKinProperties(null, null, null, null, null, null, null, null, null,
                new BookKinProperties.MetadataProviders(true, null), null);
        var service = new MetadataEnrichmentService(uploads, properties, ai, json, settings, wikidata,
                null, Duration.ZERO, url -> { throw new AssertionError("disabled provider requested: " + url); });

        var result = service.enrich(draft);

        assertEquals(List.of(wikidataCandidate), result.candidates());
        assertEquals("Example Press", result.draft().publisher());
        assertEquals("2014", result.draft().publishedDate());
        verify(wikidata).searchWithErrors(draft, false);
        verify(uploads, never()).cached(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void matchKeepsWikidataCandidatesWhenTheProviderAlsoReportsAnError() {
        var json = new JsonMapper();
        var uploads = mock(BookUploadRepository.class);
        var ai = mock(AiMetadataService.class);
        var settings = mock(MetadataProviderSettingsService.class);
        var wikidata = mock(WikidataMetadataProvider.class);
        when(settings.isEnabled(MetadataSource.OPEN_LIBRARY)).thenReturn(false);
        when(settings.isEnabled(MetadataSource.GOOGLE_BOOKS)).thenReturn(false);
        when(settings.isEnabled(MetadataSource.WIKIDATA)).thenReturn(true);
        var draft = new MetadataDraft("The Example", null, List.of("An Author"), List.of(), "en", null, null,
                null, null, null, null, List.of(), null, null, Map.of(), "An Author/The Example.epub");
        var candidate = new MetadataCandidate("wikidata:Q42", MetadataSource.WIKIDATA, "The Example", null,
                List.of("An Author"), "Example Press", "2014", "9780000000042", null, List.of(), null);
        when(wikidata.searchWithErrors(draft, false)).thenReturn(new WikidataMetadataProvider.SearchResult(
                List.of(candidate), "Wikidata 请求受到限制，已有候选仍可选择。"));
        when(ai.match(draft, List.of(candidate), null, false))
                .thenReturn(new AiMetadataService.MatchResult(List.of(), List.of(), List.of("AI 功能未启用")));
        var properties = new BookKinProperties(null, null, null, null, null, null, null, null, null,
                new BookKinProperties.MetadataProviders(false, null), null);
        var service = new MetadataEnrichmentService(uploads, properties, ai, json, settings, wikidata,
                null, Duration.ZERO, url -> { throw new AssertionError("unexpected request: " + url); });

        var result = service.match(draft, null, false);

        assertEquals(List.of(candidate), result.candidates());
        assertTrue(result.errorDetail().contains("Wikidata 请求受到限制"));
        assertTrue(result.errorDetail().contains("AI 功能未启用"));
    }

    @Test
    void reservesVisibleCandidateSlotsForAiWhenSourcesFillTheFifteenItemLimit() {
        var json = new JsonMapper();
        var uploads = mock(BookUploadRepository.class);
        var ai = mock(AiMetadataService.class);
        var settings = mock(MetadataProviderSettingsService.class);
        var wikidata = mock(WikidataMetadataProvider.class);
        when(settings.isEnabled(MetadataSource.OPEN_LIBRARY)).thenReturn(false);
        when(settings.isEnabled(MetadataSource.GOOGLE_BOOKS)).thenReturn(false);
        when(settings.isEnabled(MetadataSource.WIKIDATA)).thenReturn(true);
        var draft = new MetadataDraft("The Example", null, List.of("An Author"), List.of(), "en", null, null,
                null, null, null, null, List.of(), null, null, Map.of(), "An Author/The Example.epub");
        List<MetadataCandidate> sources = IntStream.range(0, 15).mapToObj(index ->
                new MetadataCandidate("wikidata:Q" + index, MetadataSource.WIKIDATA, "The Example " + index, null,
                        List.of("An Author"), "Example Press", "2014", null, null, List.of(), null)).toList();
        List<MetadataCandidate> aiCandidates = IntStream.range(0, 5).mapToObj(index ->
                new MetadataCandidate("ai:test:" + index, MetadataSource.AI, "The Example", null,
                        List.of("An Author"), null, null, null, null, List.of(), null)).toList();
        when(wikidata.searchWithErrors(draft, false)).thenReturn(new WikidataMetadataProvider.SearchResult(sources, null));
        when(ai.match(draft, sources, null, false))
                .thenReturn(new AiMetadataService.MatchResult(aiCandidates, List.of("test"), List.of()));
        var properties = new BookKinProperties(null, null, null, null, null, null, null, null, null,
                new BookKinProperties.MetadataProviders(false, null), null);
        var service = new MetadataEnrichmentService(uploads, properties, ai, json, settings, wikidata,
                null, Duration.ZERO, url -> { throw new AssertionError("unexpected request: " + url); });

        var result = service.match(draft, null, false);

        assertEquals(15, result.candidates().size());
        assertEquals(12, result.candidates().stream().filter(candidate -> candidate.provider() == MetadataSource.WIKIDATA).count());
        assertEquals(3, result.candidates().stream().filter(candidate -> candidate.provider() == MetadataSource.AI).count());
    }

    @Test
    void openLibraryMatchReturnsEachRealEditionAndRefreshBypassesOnlineCache() throws Exception {
        var json = new JsonMapper();
        String searchUrl = "https://openlibrary.org/search.json?title=The+Example&author=An+Author&limit=3&fields=key,title,author_name,subject,cover_i";
        String editionsUrl = "https://openlibrary.org/works/OL123W/editions.json?limit=5";
        Map<String, String> fixtures = Map.of(
                searchUrl, """
                        {"docs":[{"key":"/works/OL123W","title":"The Example","author_name":["An Author"],"subject":["History"],"cover_i":123}]}
                        """,
                editionsUrl, """
                        {"entries":[
                          {"key":"/books/OL10M","title":"The Example","edition_name":"First edition","publishers":["North Press"],"publish_date":"2001","isbn_13":["9780000000001"],"languages":[{"key":"/languages/eng"}],"covers":[10]},
                          {"key":"/books/OL11M","title":"The Example","edition_name":"Revised edition","publishers":["South Press"],"publish_date":"2012","isbn_13":["9780000000002"],"languages":[{"key":"/languages/fra"}],"covers":[11]}
                        ]}
                        """);
        Map<String, Integer> requestCounts = new HashMap<>();
        MetadataEnrichmentService.JsonTransport transport = url -> {
            requestCounts.merge(url, 1, Integer::sum);
            String fixture = fixtures.get(url);
            if (fixture == null) throw new AssertionError("Unexpected provider URL: " + url);
            return json.readTree(fixture);
        };

        var uploads = mock(BookUploadRepository.class);
        var ai = mock(AiMetadataService.class);
        var settings = mock(MetadataProviderSettingsService.class);
        var wikidata = mock(WikidataMetadataProvider.class);
        when(settings.isEnabled(MetadataSource.OPEN_LIBRARY)).thenReturn(true);
        when(settings.isEnabled(MetadataSource.GOOGLE_BOOKS)).thenReturn(false);
        when(settings.isEnabled(MetadataSource.WIKIDATA)).thenReturn(false);
        when(ai.match(any(MetadataDraft.class), anyList(), nullable(String.class), anyBoolean()))
                .thenReturn(new AiMetadataService.MatchResult(List.of(), List.of(), List.of("AI 功能未启用")));
        var properties = new BookKinProperties(null, null, null, null, null, null, null, null, null,
                new BookKinProperties.MetadataProviders(true, null), null);
        var service = new MetadataEnrichmentService(uploads, properties, ai, json, settings, wikidata,
                null, Duration.ZERO, transport);
        var draft = new MetadataDraft("The Example", null, List.of("An Author"), List.of(), "en", null, null,
                null, null, null, null, List.of(), null, null, Map.of("title", MetadataSource.FILE),
                "An Author/The Example.epub", false);

        var result = service.match(draft, null, true);

        assertEquals(2, result.candidates().size());
        var first = result.candidates().get(0);
        var second = result.candidates().get(1);
        assertEquals("/books/OL10M", first.id());
        assertEquals("North Press", first.publisher());
        assertEquals("2001", first.publishedDate());
        assertEquals("9780000000001", first.isbn());
        assertEquals("First edition", first.edition());
        assertEquals("eng", first.language());
        assertEquals("https://openlibrary.org/books/OL10M", first.sourceUrl());
        assertEquals("/books/OL11M", second.id());
        assertEquals("South Press", second.publisher());
        assertEquals("Revised edition", second.edition());
        assertEquals(2, requestCounts.size());
        assertEquals(1, requestCounts.get(searchUrl));
        assertEquals(1, requestCounts.get(editionsUrl));
        verify(uploads, never()).cached(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
        verify(ai).match(draft, result.candidates(), null, true);
        assertTrue(result.errorDetail().contains("AI 功能未启用"), "source candidates remain visible when AI is unavailable");
        assertEquals("The Example", draft.title());
        assertEquals("North Press", first.publisher());
    }
}
