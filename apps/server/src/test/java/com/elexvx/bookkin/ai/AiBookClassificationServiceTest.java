package com.elexvx.bookkin.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.auth.RolePermissionService;
import com.elexvx.bookkin.catalog.BookFile;
import com.elexvx.bookkin.catalog.BookFileStatus;
import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.catalog.BookRepository;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.infrastructure.BookTextSampler;
import com.elexvx.bookkin.filemanagement.infrastructure.KnowledgeTextGateway;
import com.elexvx.bookkin.ingestion.upload.BookUploadModels;
import com.elexvx.bookkin.ingestion.upload.BookUploadService;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRole;
import com.elexvx.bookkin.users.UserStatus;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;

class AiBookClassificationServiceTest {
    private static final UUID ID = UUID.randomUUID();
    private static final String BODY = "河流生态与水质观察：每周测量河流水温、记录水生植物和溶解氧。";
    private static final Principal PRINCIPAL = () -> "reader";
    private final AiMetadataService ai = mock(AiMetadataService.class);
    private final RolePermissionService permissions = mock(RolePermissionService.class);
    private final BookRepository books = mock(BookRepository.class);
    private final KnowledgeTextGateway texts = mock(KnowledgeTextGateway.class);
    private final BookUploadService uploads = mock(BookUploadService.class);
    private final AiBookClassificationService service = new AiBookClassificationService(ai, permissions, books, texts, uploads);
    private final BookFile file = new BookFile(UUID.randomUUID(), ID, UUID.randomUUID(), "book.pdf", BookFormat.PDF,
            BookFileStatus.AVAILABLE, 100, null, "sha256:book", false, false, false);
    private final BookTextSampler.Sample sample = new BookTextSampler.Sample(
            List.of(new BookTextSampler.Passage("page:1", BODY)), 4);

    @BeforeEach void setup() throws Exception {
        when(permissions.actor(PRINCIPAL)).thenReturn(user(UserRole.MEMBER));
        when(ai.hasAvailableProvider(null)).thenReturn(true);
        when(books.exists(ID)).thenReturn(true);
        when(books.findPreferredFile(ID)).thenReturn(Optional.of(file));
        when(texts.sample(file)).thenReturn(sample, sample);
    }

    @Test void languageSuggestionsUseBodyAndReturnNamesWithoutCreatingVocabulary() throws Exception {
        when(ai.generateStructured(anyString(), anyMap())).thenReturn(output(Map.of("items", List.of(
                Map.of("value", "nor", "label", "挪威语"), Map.of("value", "no", "label", "挪威语")))));
        var result = service.suggestTerms(new AiMetadataTermsController.Input(
                com.elexvx.bookkin.catalog.terms.MetadataTermKind.LANGUAGE,
                AiBookClassificationService.Source.BOOK, ID, true), PRINCIPAL);
        assertThat(result.items()).containsExactly(new AiBookClassificationService.TermValue("no", "挪威语"));
        verify(texts, times(2)).sample(file);
    }

    @Test void seriesSuggestionsDiscardNamesWithoutCurrentBodyEvidence() throws Exception {
        when(ai.generateStructured(anyString(), anyMap())).thenReturn(output(Map.of("items", List.of(
                Map.of("value", "虚构系列", "label", "虚构系列", "locator", "page:1", "quote", BODY)))));
        var result = service.suggestTerms(new AiMetadataTermsController.Input(
                com.elexvx.bookkin.catalog.terms.MetadataTermKind.SERIES,
                AiBookClassificationService.Source.BOOK, ID, true), PRINCIPAL);
        assertThat(result.items()).isEmpty();
    }

    @Test void classifiesFromSampledBodyAndFiltersInvalidCodesReasonsAndEvidence() throws Exception {
        when(books.reference(ID)).thenReturn(Optional.of(new BookRepository.BookReference(ID, "误导：量子诗歌与海洋谜案")));
        when(ai.generateStructured(anyString(), anyMap())).thenReturn(
                output(Map.of("roots", List.of("P", "INVALID", "Y"))),
                output(Map.of("subjects", List.of(
                                Map.of("code", "PSPF", "reason", "虚构证据不能先占据该代码。", "evidence", List.of(evidence("page:9", "这段虚构正文超过八个字符。"))),
                                Map.of("code", "PSPF", "reason", "正文聚焦淡水生态与环境指标。", "evidence", List.of(evidence("page:1", BODY))),
                                Map.of("code", "PSPF", "reason", "重复代码应去重。", "evidence", List.of(evidence("page:1", BODY))),
                                Map.of("code", "P", "reason", "根代码不可直接分类。", "evidence", List.of(evidence("page:1", BODY))),
                                Map.of("code", "J", "reason", "不在已选目录。", "evidence", List.of(evidence("page:1", BODY))),
                                Map.of("code", "PZZZ", "reason", "不存在的官方代码。", "evidence", List.of(evidence("page:1", BODY))),
                                Map.of("code", "PH", "reason", "有代码但引用虚构。", "evidence", List.of(evidence("page:9", "这段虚构正文超过八个字符。"))),
                                Map.of("code", "PS", "reason", "<script>alert(1)</script>", "evidence", List.of(evidence("page:1", BODY)))),
                        "tags", List.of(
                                Map.of("tag", "水质观察", "evidence", List.of()),
                                Map.of("tag", "水质观察", "evidence", List.of(evidence("page:1", BODY))),
                                Map.of("tag", "没有证据的主题", "evidence", List.of()),
                                Map.of("tag", "<script>恶意内容</script>", "evidence", List.of(evidence("page:1", BODY))),
                                Map.of("tag", "长".repeat(49), "evidence", List.of(evidence("page:1", BODY)))))));

        var result = service.classify(input(AiBookClassificationService.Source.BOOK, true), PRINCIPAL);

        assertThat(result.subjects()).containsExactly(new AiBookClassificationService.SubjectSuggestion(
                "PSPF", "正文聚焦淡水生态与环境指标。", List.of(new AiBookClassificationService.Evidence("page:1", BODY))));
        assertThat(result.tags()).containsExactly("水质观察");
        assertThat(result.evidence()).containsExactly(new AiBookClassificationService.Evidence("page:1", BODY));
        assertThat(result.included()).isEqualTo(1);
        assertThat(result.total()).isEqualTo(4);
        assertThat(result.coverage()).contains("1/4", "不代表全文");
        verify(ai, times(2)).generateStructured(anyString(), anyMap());
        verify(books, never()).reference(ID);

        ArgumentCaptor<String> prompts = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Map> requests = ArgumentCaptor.forClass(Map.class);
        verify(ai, times(2)).generateStructured(prompts.capture(), requests.capture());
        String sentInput = requests.getAllValues().toString();
        assertThat(sentInput).contains(BODY, "PSPF").doesNotContain("误导：量子诗歌与海洋谜案", "人工标签");
        assertThat(prompts.getAllValues().toString()).doesNotContain("误导：量子诗歌与海洋谜案");
    }

    @Test void bookRequiresBothReadingAndEditingGrantsBeforeProviderOrFileAccess() {
        doThrow(ApiException.forbidden("PERMISSION_DENIED", "没有阅读权限。"))
                .when(permissions).require(PRINCIPAL, "reader.read");

        assertThatThrownBy(() -> service.classify(input(AiBookClassificationService.Source.BOOK, true), PRINCIPAL))
                .isInstanceOf(ApiException.class).hasMessage("没有阅读权限。");

        verifyNoInteractions(ai, books, texts, uploads);
    }

    @Test void bookEditGrantIsRequiredAfterTheReadingGrant() {
        doThrow(ApiException.forbidden("PERMISSION_DENIED", "没有编辑权限。"))
                .when(permissions).require(PRINCIPAL, "library.edit");

        assertThatThrownBy(() -> service.classify(input(AiBookClassificationService.Source.BOOK, true), PRINCIPAL))
                .isInstanceOf(ApiException.class).hasMessage("没有编辑权限。");

        verify(permissions).require(PRINCIPAL, "reader.read");
        verifyNoInteractions(ai, books, texts, uploads);
    }

    @Test void noConsentIsRejectedBeforePermissionsAndFileReads() {
        assertThatThrownBy(() -> service.classify(input(AiBookClassificationService.Source.BOOK, false), PRINCIPAL))
                .isInstanceOf(ApiException.class).hasMessageContaining("确认");
        verifyNoInteractions(permissions, ai, books, texts, uploads);
    }

    @Test void emptySampleIsRejectedBeforeProviderAvailabilityCheck() throws Exception {
        when(texts.sample(file)).thenReturn(new BookTextSampler.Sample(List.of(), 6));
        assertThatThrownBy(() -> service.classify(input(AiBookClassificationService.Source.BOOK, true), PRINCIPAL))
                .isInstanceOf(ApiException.class).hasMessageContaining("扫描件");
        verifyNoInteractions(ai);
    }

    @Test void missingProviderHasAConcreteErrorWithoutGeneration() throws Exception {
        when(texts.sample(file)).thenReturn(sample);
        when(ai.hasAvailableProvider(null)).thenReturn(false);
        assertThatThrownBy(() -> service.classify(input(AiBookClassificationService.Source.BOOK, true), PRINCIPAL))
                .isInstanceOf(ApiException.class).hasMessageContaining("配置平台");
        verify(ai, never()).generateStructured(anyString(), anyMap());
    }

    @Test void uploadRequiresManagerRoleAndCallsOwnedUploadSamplerOnlyAfterAuthorization() throws Exception {
        assertThatThrownBy(() -> service.classify(input(AiBookClassificationService.Source.UPLOAD, true), PRINCIPAL))
                .isInstanceOf(ApiException.class).hasMessageContaining("主人或管理员");
        verifyNoInteractions(ai, uploads, books, texts);

        when(permissions.actor(PRINCIPAL)).thenReturn(user(UserRole.ADMIN));
        when(uploads.get(ID, PRINCIPAL)).thenReturn(upload());
        when(uploads.sampleText(ID, PRINCIPAL)).thenReturn(sample);
        when(ai.generateStructured(anyString(), anyMap())).thenReturn(
                output(Map.of("roots", List.of("P"))),
                output(Map.of("subjects", List.of(), "tags", List.of(Map.of("tag", "水质观察", "evidence", List.of(evidence("page:1", BODY)))))));

        var result = service.classify(input(AiBookClassificationService.Source.UPLOAD, true), PRINCIPAL);

        assertThat(result.tags()).containsExactly("水质观察");
        assertThat(result.evidence()).containsExactly(new AiBookClassificationService.Evidence("page:1", BODY));
        verify(uploads, times(3)).get(ID, PRINCIPAL);
        verify(uploads).sampleText(ID, PRINCIPAL);
        verifyNoInteractions(books, texts);
    }

    @Test void missingRootChoiceStillRequestsOnlyEvidenceBackedTags() throws Exception {
        when(ai.generateStructured(anyString(), anyMap())).thenReturn(
                output(Map.of("roots", List.of("invalid"))),
                output(Map.of("tags", List.of(Map.of("tag", "水质观察", "evidence", List.of(evidence("page:1", BODY)))))));

        var result = service.classify(input(AiBookClassificationService.Source.BOOK, true), PRINCIPAL);

        assertThat(result.subjects()).isEmpty();
        assertThat(result.tags()).containsExactly("水质观察");
        verify(ai, times(2)).generateStructured(anyString(), anyMap());
    }

    @Test void limitsEachClassificationResponseToFiveTagCandidates() throws Exception {
        var tags = java.util.stream.IntStream.rangeClosed(1, 8).mapToObj(index -> Map.of(
                "tag", "正文主题" + index, "evidence", List.of(evidence("page:1", BODY)))).toList();
        when(ai.generateStructured(anyString(), anyMap())).thenReturn(
                output(Map.of("roots", List.of("invalid"))), output(Map.of("tags", tags)));

        var result = service.classify(input(AiBookClassificationService.Source.BOOK, true), PRINCIPAL);

        assertThat(result.tags()).containsExactly("正文主题1", "正文主题2", "正文主题3", "正文主题4", "正文主题5");
    }

    @Test void bookFingerprintChangeDuringProviderRequestRejectsTheStaleSuggestions() throws Exception {
        BookFile changed = new BookFile(file.id(), ID, file.libraryRootId(), file.relativePath(), BookFormat.PDF,
                BookFileStatus.AVAILABLE, file.sizeBytes(), file.modifiedAt(), "sha256:changed", false, false, false);
        when(books.findPreferredFile(ID)).thenReturn(Optional.of(file), Optional.of(changed));
        when(texts.sample(changed)).thenReturn(sample);
        when(ai.generateStructured(anyString(), anyMap())).thenReturn(
                output(Map.of("roots", List.of("P"))), output(Map.of("subjects", List.of(), "tags", List.of())));

        assertThatThrownBy(() -> service.classify(input(AiBookClassificationService.Source.BOOK, true), PRINCIPAL))
                .isInstanceOf(ApiException.class).hasMessageContaining("正文已更新");
        verify(ai, times(2)).generateStructured(anyString(), anyMap());
    }

    @Test void uploadDiskChangeDuringProviderRequestRejectsTheStaleSuggestions() throws Exception {
        when(permissions.actor(PRINCIPAL)).thenReturn(user(UserRole.ADMIN));
        when(uploads.get(ID, PRINCIPAL)).thenReturn(upload());
        when(uploads.sampleText(ID, PRINCIPAL)).thenReturn(sample);
        when(ai.generateStructured(anyString(), anyMap())).thenReturn(
                output(Map.of("roots", List.of("P"))), output(Map.of("subjects", List.of(), "tags", List.of())));
        doThrow(ApiException.conflict("UPLOAD_FILE_CHANGED", "暂存文件内容已变化。"))
                .when(uploads).verifyTextSource(ID, PRINCIPAL);

        assertThatThrownBy(() -> service.classify(input(AiBookClassificationService.Source.UPLOAD, true), PRINCIPAL))
                .isInstanceOf(ApiException.class).hasMessageContaining("暂存文件内容已变化");
        verify(uploads).verifyTextSource(ID, PRINCIPAL);
        verify(ai, times(2)).generateStructured(anyString(), anyMap());
    }

    private AiBookClassificationController.Input input(AiBookClassificationService.Source source, boolean consent) {
        return new AiBookClassificationController.Input(source, ID, consent);
    }

    private BookKinUser user(UserRole role) {
        return new BookKinUser(UUID.randomUUID(), "reader", "读者", "", role, UserStatus.ACTIVE, false, null, null);
    }

    private AiMetadataService.StructuredResult output(Map<String, Object> value) {
        return new AiMetadataService.StructuredResult("provider", "model", new ObjectMapper().valueToTree(value));
    }

    private Map<String, String> evidence(String locator, String quote) {
        return Map.of("locator", locator, "quote", quote);
    }

    private BookUploadModels.BookUpload upload() {
        OffsetDateTime expires = OffsetDateTime.now().plusHours(1);
        OffsetDateTime now = OffsetDateTime.now();
        return new BookUploadModels.BookUpload(ID, UUID.randomUUID(), "root", "upload.pdf", BookFormat.PDF,
                100, 100, "sha256:upload", BookUploadModels.BookUploadStatus.READY_FOR_REVIEW, false, false, false,
                null, null, List.of(), null, null, null, List.of(), "target.pdf", null, null, null, expires, now, now);
    }
}
