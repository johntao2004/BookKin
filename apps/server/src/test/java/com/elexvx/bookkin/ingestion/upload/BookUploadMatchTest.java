package com.elexvx.bookkin.ingestion.upload;

import static com.elexvx.bookkin.ingestion.upload.BookUploadModels.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.ai.AiSettingsService;
import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.catalog.DisplayCatalogService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.config.BookKinProperties;
import com.elexvx.bookkin.filemanagement.FileFingerprints;
import com.elexvx.bookkin.filemanagement.FileInspector;
import com.elexvx.bookkin.filemanagement.PathPolicy;
import com.elexvx.bookkin.ingestion.CatalogIngestionRepository;
import com.elexvx.bookkin.ingestion.LibraryRootRepository;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import com.elexvx.bookkin.users.UserRole;
import com.elexvx.bookkin.users.UserStatus;
import java.security.Principal;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class BookUploadMatchTest {
    @Test
    void noResultsKeepPriorCandidatesAndDraftWhileRecordingRetryableError() {
        var actorId = UUID.randomUUID();
        var uploadId = UUID.randomUUID();
        var prior = new MetadataCandidate("old-edition", MetadataSource.OPEN_LIBRARY, "Old Book", null,
                List.of("Author"), "Old Publisher", "1999", "9780000000000", null, List.of(), null);
        var draft = draft();
        var upload = upload(uploadId, actorId, draft, List.of(prior));
        var setup = setup(actorId, uploadId, upload);
        when(setup.enrichment.match(eq(draft), eq(null), eq(false)))
                .thenReturn(new MetadataEnrichmentService.MatchResult(List.of(), "AI 平台暂时不可用，可稍后重试"));

        var result = setup.service.match(uploadId, false, null, setup.principal);

        assertEquals(draft, result.draftMetadata());
        assertEquals(List.of(prior), result.metadataCandidates());
        verify(setup.uploads).resetReady(uploadId, "MATCH_NO_RESULTS", "AI 平台暂时不可用，可稍后重试");
        verify(setup.uploads, never()).matchCompleted(any(), any(), any(), any());
        verify(setup.uploads, never()).updateDraft(any(), any());
    }

    @Test
    void matchingAnotherUsersUploadDoesNotStartProcessing() {
        var actorId = UUID.randomUUID();
        var uploadId = UUID.randomUUID();
        var setup = setup(actorId, uploadId, null);
        when(setup.uploads.findOwned(uploadId, actorId)).thenReturn(Optional.empty());

        assertThrows(ApiException.class, () -> setup.service.match(uploadId, false, null, setup.principal));

        verify(setup.uploads, never()).processing(any(), any());
        verify(setup.enrichment, never()).match(any(), any(), anyBoolean());
    }

    @Test
    void partialMatchPersistsCandidatesAndErrorWithoutWritingDraft() {
        var actorId = UUID.randomUUID();
        var uploadId = UUID.randomUUID();
        var draft = draft();
        var upload = upload(uploadId, actorId, draft, List.of());
        var setup = setup(actorId, uploadId, upload);
        var candidates = List.of(new MetadataCandidate("wikidata:Q42", MetadataSource.WIKIDATA,
                "The Example", null, List.of("Author"), "Example Press", "2014", "9780000000042",
                null, List.of(), null));
        when(setup.enrichment.match(eq(draft), eq("provider-1"), eq(true)))
                .thenReturn(new MetadataEnrichmentService.MatchResult(candidates, "AI 平台不可用，可重试"));
        when(setup.uploads.matchCompleted(uploadId, candidates, "MATCH_PARTIAL", "AI 平台不可用，可重试")).thenReturn(true);

        setup.service.match(uploadId, true, "provider-1", setup.principal);

        verify(setup.uploads).matchCompleted(uploadId, candidates, "MATCH_PARTIAL", "AI 平台不可用，可重试");
        verify(setup.uploads, never()).updateDraft(any(), any());
    }

    @Test
    void matchingWikidataFieldRetainsSourceButDoesNotReplaceAnUnchangedManualField() throws Exception {
        var actorId = UUID.randomUUID();
        var setup = setup(actorId, UUID.randomUUID(), null);
        var before = new MetadataDraft("The Example", null, List.of("Author"), List.of(), null, null, null, null,
                null, null, null, List.of(), null, null, Map.of(), "Author/The Example.epub", true);
        var after = new MetadataDraft("The Example", null, List.of("Author"), List.of(), "eng", null, null, null,
                null, null, null, List.of(), null, null, Map.of(), "Author/The Example.epub", true);
        var candidate = new MetadataCandidate("wikidata:Q42", MetadataSource.WIKIDATA, "Wikidata", "The Example", null,
                List.of("Author"), null, null, null, null, List.of(), null, null, null, false,
                null, "eng", "https://www.wikidata.org/entity/Q42");
        Map<String, MetadataSource> sources = new HashMap<>();
        markChanges(setup.service, sources, before, after, Map.of("language", MetadataSource.WIKIDATA), List.of(candidate));
        assertEquals(MetadataSource.WIKIDATA, sources.get("language"));

        var manualDraft = new MetadataDraft("The Example", null, List.of("Author"), List.of(), "eng", null, null, null,
                null, null, null, List.of(), null, null, Map.of("language", MetadataSource.MANUAL),
                "Author/The Example.epub", true);
        Map<String, MetadataSource> manualSources = new HashMap<>(manualDraft.sources());
        markChanges(setup.service, manualSources, manualDraft, manualDraft,
                Map.of("language", MetadataSource.WIKIDATA), List.of(candidate));
        assertEquals(MetadataSource.MANUAL, manualSources.get("language"));
    }

    private Setup setup(UUID actorId, UUID uploadId, UploadEntity upload) {
        var uploads = mock(BookUploadRepository.class);
        var processor = mock(BookUploadProcessor.class);
        var enrichment = mock(MetadataEnrichmentService.class);
        var ai = mock(AiMetadataService.class);
        var aiSettings = mock(AiSettingsService.class);
        var roots = mock(LibraryRootRepository.class);
        var catalog = mock(CatalogIngestionRepository.class);
        var displayCatalog = mock(DisplayCatalogService.class);
        var users = mock(UserRepository.class);
        var inspector = mock(FileInspector.class);
        var fingerprints = mock(FileFingerprints.class);
        var paths = mock(PathPolicy.class);
        var properties = new BookKinProperties(null, null, null, null, null, null, null, null, null, null, null);
        var audit = mock(AuditService.class);
        when(users.findByUsername("owner")).thenReturn(Optional.of(new BookKinUser(actorId, "owner", "Owner", "hash",
                UserRole.OWNER, UserStatus.ACTIVE, false, OffsetDateTime.now(), null)));
        if (upload != null) {
            when(uploads.findOwned(uploadId, actorId)).thenReturn(Optional.of(upload));
            when(uploads.processing(uploadId, BookUploadStatus.ENRICHING)).thenReturn(true);
        }
        var service = new BookUploadService(uploads, processor, enrichment, ai, aiSettings, roots, catalog, users,
                inspector, fingerprints, paths, properties, audit, new JsonMapper(), displayCatalog);
        return new Setup(service, uploads, enrichment, () -> "owner");
    }

    private UploadEntity upload(UUID id, UUID actor, MetadataDraft draft, List<MetadataCandidate> candidates) {
        var now = OffsetDateTime.now();
        return new UploadEntity(id, actor, UUID.randomUUID(), "Default", "book.epub", ".bookkin-staging/uploads/book.epub",
                BookFormat.EPUB, 10, 10, "sha256:upload", BookUploadStatus.READY_FOR_REVIEW, false, false, false,
                draft, draft, candidates, null, null, null, null, List.of(), draft.targetPath(), null, null, null,
                null, now.plusDays(1), now, now);
    }

    private MetadataDraft draft() {
        return new MetadataDraft("The Example", null, List.of("Author"), List.of(), "en", null, null, null, null,
                null, null, List.of(), null, null, Map.of("title", MetadataSource.FILE), "Author/The Example.epub", false);
    }

    private void markChanges(BookUploadService service, Map<String, MetadataSource> sources,
                             MetadataDraft before, MetadataDraft after, Map<String, MetadataSource> requested,
                             List<MetadataCandidate> candidates) throws Exception {
        Method method = BookUploadService.class.getDeclaredMethod("markChanges", Map.class, MetadataDraft.class,
                MetadataDraft.class, Map.class, List.class);
        method.setAccessible(true);
        method.invoke(service, sources, before, after, requested, candidates);
    }

    private record Setup(BookUploadService service, BookUploadRepository uploads,
                         MetadataEnrichmentService enrichment, Principal principal) {}
}
