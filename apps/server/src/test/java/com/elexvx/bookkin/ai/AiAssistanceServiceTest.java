package com.elexvx.bookkin.ai;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.elexvx.bookkin.articles.*;
import com.elexvx.bookkin.auth.RolePermissionService;
import com.elexvx.bookkin.catalog.*;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.infrastructure.*;
import com.elexvx.bookkin.users.*;
import java.security.Principal;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class AiAssistanceServiceTest {
    final AiMetadataService ai = mock(AiMetadataService.class);
    final RolePermissionService permissions = mock(RolePermissionService.class);
    final BookRepository books = mock(BookRepository.class);
    final KnowledgeTextGateway texts = mock(KnowledgeTextGateway.class);
    final ArticleService articles = mock(ArticleService.class);
    final ArticleCollectionService collections = mock(ArticleCollectionService.class);
    final AiAssistanceService service = new AiAssistanceService(ai, permissions, books, texts, articles, collections);
    final Principal principal = () -> "reader";
    final UUID id = UUID.randomUUID();
    final String body = "沿河散步时先观察水位，再记录岸边植物的变化。";
    final BookFile file = new BookFile(UUID.randomUUID(), id, UUID.randomUUID(), "book.pdf", BookFormat.PDF,
            BookFileStatus.AVAILABLE, 10, null, "sha256:original", false, false, false);
    @BeforeEach void setup() throws Exception {
        when(permissions.actor(principal)).thenReturn(new BookKinUser(UUID.randomUUID(), "reader", "读者", "", UserRole.MEMBER, UserStatus.ACTIVE, false, null, null));
        when(ai.hasAvailableProvider(null)).thenReturn(true);
        when(books.reference(id)).thenReturn(Optional.of(new BookRepository.BookReference(id, "沿河散步")));
        when(books.findPreferredFile(id)).thenReturn(Optional.of(file));
        when(texts.sample(file)).thenReturn(new BookTextSampler.Sample(List.of(new BookTextSampler.Passage("page:1", body)), 3));
        when(ai.generateStructured(anyString(), anyMap())).thenReturn(output("先观察水位。", "page:1", body));
    }
    AiAssistanceController.Input input(AiAssistanceService.SourceType source, AiAssistanceService.Action action, boolean consent) {
        return new AiAssistanceController.Input(source, id.toString(), action, "观察什么？", "私人草稿，沿河记录感想。", consent);
    }
    AiMetadataService.StructuredResult output(String text, String locator, String quote) throws Exception {
        var json = new ObjectMapper();
        return new AiMetadataService.StructuredResult("DeepSeek", "model", json.valueToTree(Map.of("text", text, "evidence", List.of(Map.of("locator", locator, "quote", quote)))));
    }
    @Test void requiresConsentBeforeReadingOrCallingProvider() {
        assertThatThrownBy(() -> service.assist(input(AiAssistanceService.SourceType.BOOK, AiAssistanceService.Action.SUMMARY, false), principal))
                .isInstanceOf(ApiException.class).hasMessageContaining("确认");
        verifyNoInteractions(books, texts, articles, collections, ai);
    }
    @Test void disabledAiDoesNotReadSource() {
        when(ai.hasAvailableProvider(null)).thenReturn(false);
        assertThatThrownBy(() -> service.assist(input(AiAssistanceService.SourceType.BOOK, AiAssistanceService.Action.SUMMARY, true), principal)).isInstanceOf(ApiException.class);
        verifyNoInteractions(books, texts, articles, collections);
    }
    @Test void sourceGrantCannotBeReplacedByAnotherAvailableGrant() {
        doThrow(ApiException.forbidden("PERMISSION_DENIED", "禁止阅读")).when(permissions).require(principal, "reader.read");
        assertThatThrownBy(() -> service.assist(input(AiAssistanceService.SourceType.BOOK, AiAssistanceService.Action.SUMMARY, true), principal)).hasMessage("禁止阅读");
        verifyNoInteractions(ai, books, texts);
    }
    @Test void privateArticleDeniedBeforeModelCall() throws Exception {
        when(articles.get(id, principal)).thenThrow(ApiException.notFound("ARTICLE_NOT_FOUND", "文章不存在或无权访问。"));
        assertThatThrownBy(() -> service.assist(input(AiAssistanceService.SourceType.ARTICLE, AiAssistanceService.Action.ASK, true), principal)).isInstanceOf(ApiException.class);
        verify(ai, never()).generateStructured(anyString(), anyMap());
    }
    @Test void unsupportedSourceActionCannotTurnReadingIntoEditing() {
        assertThatThrownBy(() -> service.assist(input(AiAssistanceService.SourceType.BOOK, AiAssistanceService.Action.POLISH, true), principal)).isInstanceOf(ApiException.class);
        verifyNoInteractions(ai, books, texts);
    }
    @Test void metadataDraftNeedsEditOrUploadGrant() {
        when(permissions.snapshot(principal)).thenReturn(new RolePermissionService.Snapshot(UserRole.MEMBER, 1, Set.of("reader.read")));
        assertThatThrownBy(() -> service.assist(input(AiAssistanceService.SourceType.METADATA_DRAFT, AiAssistanceService.Action.TAGS, true), principal)).isInstanceOf(ApiException.class);
        verifyNoInteractions(ai);
    }
    @Test void onlyExactEvidenceAndSamplingCoverageAreReturned() throws Exception {
        var result = service.assist(input(AiAssistanceService.SourceType.BOOK, AiAssistanceService.Action.SUMMARY, true), principal);
        assertThat(result.text()).isEqualTo("先观察水位。");
        assertThat(result.evidence()).containsExactly(new AiAssistanceService.Evidence("page:1", body));
        assertThat(result.included()).isEqualTo(1); assertThat(result.total()).isEqualTo(3);
        verify(permissions, times(2)).require(principal, "reader.read");
        verify(books, never()).findSummary(any(), any());
    }
    @Test void fabricatedEvidenceCannotSupportAnAnswer() throws Exception {
        when(ai.generateStructured(anyString(), anyMap())).thenReturn(output("编造的答案", "page:99", body));
        var result = service.assist(input(AiAssistanceService.SourceType.BOOK, AiAssistanceService.Action.ASK, true), principal);
        assertThat(result.evidence()).isEmpty(); assertThat(result.text()).contains("不足").doesNotContain("编造");
    }
    @Test void sourceChangesDuringGenerationDiscardResult() throws Exception {
        when(texts.sample(file)).thenReturn(new BookTextSampler.Sample(List.of(new BookTextSampler.Passage("page:1", body)), 3),
                new BookTextSampler.Sample(List.of(new BookTextSampler.Passage("page:1", "新的正文")), 3));
        assertThatThrownBy(() -> service.assist(input(AiAssistanceService.SourceType.BOOK, AiAssistanceService.Action.SUMMARY, true), principal)).isInstanceOf(ApiException.class).hasMessageContaining("更新");
    }
    @Test void revokedGrantDuringGenerationDiscardsResult() throws Exception {
        doNothing().doThrow(ApiException.forbidden("PERMISSION_DENIED", "权限已撤回")).when(permissions).require(principal, "reader.read");
        assertThatThrownBy(() -> service.assist(input(AiAssistanceService.SourceType.BOOK, AiAssistanceService.Action.SUMMARY, true), principal)).hasMessage("权限已撤回");
    }
    @Test void draftRequestNeverReadsStoredNotesOrBooks() throws Exception {
        var result = service.assist(input(AiAssistanceService.SourceType.NOTE_DRAFT, AiAssistanceService.Action.POLISH, true), principal);
        assertThat(result.text()).isEqualTo("先观察水位。");
        verifyNoInteractions(books, texts, articles, collections);
        verify(permissions, times(2)).require(principal, "notes.edit");
    }
    @Test void oversizedDraftIsRejectedBeforeExternalRequest() {
        var input = new AiAssistanceController.Input(AiAssistanceService.SourceType.NOTE_DRAFT, null, AiAssistanceService.Action.POLISH, null, "字".repeat(20001), true);
        assertThatThrownBy(() -> service.assist(input, principal)).isInstanceOf(ApiException.class);
        verifyNoInteractions(ai);
    }
    @Test void oneRequestPerUserAndFailureReleasesInFlightSlot() throws Exception {
        var started = new CountDownLatch(1); var release = new CountDownLatch(1);
        when(ai.generateStructured(anyString(), anyMap())).thenAnswer(call -> { started.countDown(); release.await(5, TimeUnit.SECONDS); throw new IllegalStateException("upstream unavailable"); });
        try (var executor = Executors.newSingleThreadExecutor()) {
            var future = executor.submit(() -> service.assist(input(AiAssistanceService.SourceType.BOOK, AiAssistanceService.Action.SUMMARY, true), principal));
            assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(() -> service.assist(input(AiAssistanceService.SourceType.BOOK, AiAssistanceService.Action.SUMMARY, true), principal)).isInstanceOf(ApiException.class).hasMessageContaining("等待");
            release.countDown(); assertThatThrownBy(future::get).isInstanceOf(ExecutionException.class);
        } finally { release.countDown(); }
    }
}
