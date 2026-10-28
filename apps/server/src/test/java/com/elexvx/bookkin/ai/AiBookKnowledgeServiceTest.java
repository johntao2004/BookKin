package com.elexvx.bookkin.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
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
import com.elexvx.bookkin.catalog.knowledge.KnowledgeDraft;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.infrastructure.BookTextSampler;
import com.elexvx.bookkin.filemanagement.infrastructure.KnowledgeTextGateway;
import com.elexvx.bookkin.ingestion.upload.BookUploadService;
import com.elexvx.bookkin.ingestion.upload.BookUploadModels;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRole;
import com.elexvx.bookkin.users.UserStatus;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AiBookKnowledgeServiceTest {
    private static final UUID ID = UUID.randomUUID();
    private static final Principal MEMBER = () -> "member";
    private static final String BODY = "认知偏差会影响人们处理信息时的判断和决策。";
    private final AiMetadataService ai = mock(AiMetadataService.class);
    private final RolePermissionService permissions = mock(RolePermissionService.class);
    private final BookRepository books = mock(BookRepository.class);
    private final KnowledgeTextGateway text = mock(KnowledgeTextGateway.class);
    private final BookUploadService uploads = mock(BookUploadService.class);
    private final AiBookKnowledgeService service = new AiBookKnowledgeService(ai, permissions, books, text, uploads);
    private final BookFile file = new BookFile(UUID.randomUUID(), ID, UUID.randomUUID(), "book.epub", BookFormat.EPUB,
            BookFileStatus.AVAILABLE, 100, OffsetDateTime.now(), "sha256:book", false, false, false);
    private final BookTextSampler.Sample sample = new BookTextSampler.Sample(
            List.of(new BookTextSampler.Passage("chapter:1", BODY)), 6);
    private final List<AiMetadataService.KnowledgePoint> points = List.of(
            new AiMetadataService.KnowledgePoint("认知偏差", BODY, "chapter:1"));

    private AiBookKnowledgeController.Input input(AiBookClassificationService.Source source, boolean consent) {
        return new AiBookKnowledgeController.Input(source, ID, consent);
    }

    private BookKinUser user(UserRole role) {
        return new BookKinUser(UUID.randomUUID(), "member", "读者", "", role, UserStatus.ACTIVE, false, null, null);
    }

    @Test
    void memberCanPreviewOnlyAfterConsentAndRequiredBookPermissions() throws Exception {
        when(permissions.actor(MEMBER)).thenReturn(user(UserRole.MEMBER));
        when(books.exists(ID)).thenReturn(true);
        when(books.findPreferredFile(ID)).thenReturn(Optional.of(file));
        when(text.sample(file)).thenReturn(sample, sample);
        when(ai.hasAvailableProvider(null)).thenReturn(true);
        when(ai.extractKnowledge(anyList())).thenReturn(new AiMetadataService.KnowledgeResult("provider", points));

        KnowledgeDraft result = service.generate(input(AiBookClassificationService.Source.BOOK, true), MEMBER);

        assertThat(result).isEqualTo(new com.elexvx.bookkin.catalog.knowledge.KnowledgeDraft(points,
                file.fingerprint(), 1, 6, "provider"));
        verify(permissions, times(2)).require(MEMBER, "reader.read");
        verify(permissions, times(2)).require(MEMBER, "library.edit");
        verify(books, never()).reference(ID);
        verifyNoInteractions(uploads);
    }

    @Test
    void memberCannotGenerateForAnUploadAndConsentIsRequiredBeforeAnyReads() {
        when(permissions.actor(MEMBER)).thenReturn(user(UserRole.MEMBER));
        assertThatThrownBy(() -> service.generate(input(AiBookClassificationService.Source.UPLOAD, true), MEMBER))
                .isInstanceOf(ApiException.class).hasMessageContaining("主人或管理员");
        verifyNoInteractions(uploads, ai, books, text);

        assertThatThrownBy(() -> service.generate(input(AiBookClassificationService.Source.BOOK, false), MEMBER))
                .isInstanceOf(ApiException.class).hasMessageContaining("确认");
        verify(permissions).actor(MEMBER);
        verifyNoInteractions(ai, books, text);
    }

    @Test
    void editGrantIsRequiredBeforeBookFileAccess() {
        when(permissions.actor(MEMBER)).thenReturn(user(UserRole.MEMBER));
        doThrow(ApiException.forbidden("PERMISSION_DENIED", "没有书目编辑权限。"))
                .when(permissions).require(MEMBER, "library.edit");

        assertThatThrownBy(() -> service.generate(input(AiBookClassificationService.Source.BOOK, true), MEMBER))
                .isInstanceOf(ApiException.class).hasMessageContaining("书目编辑权限");

        verifyNoInteractions(books, text, ai, uploads);
    }

    @Test
    void staleFileIdentityAfterProviderResponseRejectsPreview() throws Exception {
        when(permissions.actor(MEMBER)).thenReturn(user(UserRole.MEMBER));
        when(books.exists(ID)).thenReturn(true);
        BookFile changed = new BookFile(file.id(), ID, file.libraryRootId(), file.relativePath(), file.format(),
                BookFileStatus.AVAILABLE, file.sizeBytes(), file.modifiedAt(), "sha256:changed", false, false, false);
        when(books.findPreferredFile(ID)).thenReturn(Optional.of(file), Optional.of(file),
                Optional.of(changed), Optional.of(changed));
        when(text.sample(file)).thenReturn(sample);
        when(text.sample(changed)).thenReturn(sample);
        when(ai.hasAvailableProvider(null)).thenReturn(true);
        when(ai.extractKnowledge(anyList())).thenReturn(new AiMetadataService.KnowledgeResult("provider", points));

        assertThatThrownBy(() -> service.generate(input(AiBookClassificationService.Source.BOOK, true), MEMBER))
                .isInstanceOf(ApiException.class).hasMessageContaining("正文已更新");

        verify(ai).extractKnowledge(anyList());
    }

    @Test
    void adminCanPreviewOwnedUploadBodyAndRechecksItAfterProviderCall() throws Exception {
        when(permissions.actor(MEMBER)).thenReturn(user(UserRole.ADMIN));
        BookUploadModels.BookUpload upload = upload("sha256:upload");
        when(uploads.get(ID, MEMBER)).thenReturn(upload);
        when(uploads.sampleText(ID, MEMBER)).thenReturn(sample, sample);
        when(ai.hasAvailableProvider(null)).thenReturn(true);
        when(ai.extractKnowledge(anyList())).thenReturn(new AiMetadataService.KnowledgeResult("provider", points));

        KnowledgeDraft result = service.generate(input(AiBookClassificationService.Source.UPLOAD, true), MEMBER);

        assertThat(result.fingerprint()).isEqualTo("sha256:upload");
        assertThat(result.points()).isEqualTo(points);
        verify(permissions, times(2)).require(MEMBER, "library.upload");
        verify(uploads, times(4)).get(ID, MEMBER);
        verify(uploads, times(2)).sampleText(ID, MEMBER);
        verifyNoInteractions(books, text);
    }

    @Test
    void changedUploadFingerprintDiscardsGeneratedPreview() throws Exception {
        when(permissions.actor(MEMBER)).thenReturn(user(UserRole.ADMIN));
        BookUploadModels.BookUpload upload = upload("sha256:upload");
        BookUploadModels.BookUpload changed = upload("sha256:changed");
        when(uploads.get(ID, MEMBER)).thenReturn(upload, upload, changed, changed);
        when(uploads.sampleText(ID, MEMBER)).thenReturn(sample, sample);
        when(ai.hasAvailableProvider(null)).thenReturn(true);
        when(ai.extractKnowledge(anyList())).thenReturn(new AiMetadataService.KnowledgeResult("provider", points));

        assertThatThrownBy(() -> service.generate(input(AiBookClassificationService.Source.UPLOAD, true), MEMBER))
                .isInstanceOf(ApiException.class).hasMessageContaining("正文已更新");

        verify(ai).extractKnowledge(anyList());
    }

    private BookUploadModels.BookUpload upload(String fingerprint) {
        OffsetDateTime expires = OffsetDateTime.now().plusHours(1);
        OffsetDateTime now = OffsetDateTime.now();
        return new BookUploadModels.BookUpload(ID, UUID.randomUUID(), "root", "upload.epub", BookFormat.EPUB,
                100, 100, fingerprint, BookUploadModels.BookUploadStatus.READY_FOR_REVIEW, false, false, false,
                null, null, List.of(), null, null, null, List.of(), "target.epub", null, null, null, expires, now, now);
    }
}
