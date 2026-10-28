package com.elexvx.bookkin.catalog.knowledge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.auth.RolePermissionService;
import com.elexvx.bookkin.catalog.BookFile;
import com.elexvx.bookkin.catalog.BookFileStatus;
import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.catalog.BookRepository;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.infrastructure.BookTextSampler;
import com.elexvx.bookkin.filemanagement.infrastructure.KnowledgeTextGateway;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class KnowledgeDraftServiceTest {
    private static final UUID BOOK_ID = UUID.randomUUID();
    private static final Principal MEMBER = () -> "member";
    private static final String BODY = "认知偏差会影响人们处理信息时的判断和决策。";
    private final BookRepository books = mock(BookRepository.class);
    private final KnowledgeRepository knowledge = mock(KnowledgeRepository.class);
    private final KnowledgeTextGateway text = mock(KnowledgeTextGateway.class);
    private final AiMetadataService ai = mock(AiMetadataService.class);
    private final RolePermissionService permissions = mock(RolePermissionService.class);
    private final KnowledgeDraftService service = new KnowledgeDraftService(books, knowledge, text, ai, permissions);
    private final BookFile file = new BookFile(UUID.randomUUID(), BOOK_ID, UUID.randomUUID(), "book.epub", BookFormat.EPUB,
            BookFileStatus.AVAILABLE, 100, OffsetDateTime.now(), "sha256:book", false, false, false);
    private final AiMetadataService.KnowledgePoint point =
            new AiMetadataService.KnowledgePoint("认知偏差", BODY, "chapter:1");
    private final BookTextSampler.Sample sample = new BookTextSampler.Sample(
            List.of(new BookTextSampler.Passage("chapter:1", BODY)), 8);

    private void bookExists() {
        when(books.exists(BOOK_ID)).thenReturn(true);
        when(books.findPreferredFile(BOOK_ID)).thenReturn(Optional.of(file));
    }

    @Test
    void memberCanReadCurrentKnowledgeDraftWithoutBookEditGrant() throws Exception {
        bookExists();
        when(knowledge.current(file)).thenReturn(Optional.empty());

        KnowledgeDraft result = service.readBook(BOOK_ID, MEMBER);

        assertThat(result.points()).isEmpty();
        assertThat(result.fingerprint()).isEqualTo(file.fingerprint());
        verify(permissions).require(MEMBER, "knowledge.view");
        verify(permissions).require(MEMBER, "reader.read");
        verify(permissions, never()).require(MEMBER, "library.edit");
    }

    @Test
    void memberCannotSaveKnowledgeChangesWithoutBookEditGrant() {
        doThrow(ApiException.forbidden("PERMISSION_DENIED", "没有编辑权限。"))
                .when(permissions).require(MEMBER, "library.edit");

        assertThatThrownBy(() -> service.saveBook(BOOK_ID,
                new KnowledgeDraft(List.of(), file.fingerprint(), 0, 0, null), MEMBER))
                .isInstanceOf(ApiException.class);

        verifyNoInteractions(books, text, knowledge);
    }

    @Test
    void selectionUsesCurrentSourceAndServerMeasuredCountsWhenSaving() throws Exception {
        bookExists();
        when(text.sample(file)).thenReturn(sample);
        when(ai.verifyKnowledgeSelection(List.of(point), List.of(
                new AiMetadataService.KnowledgePassage("chapter:1", BODY)))).thenReturn(List.of(point));

        service.saveBook(BOOK_ID, new KnowledgeDraft(List.of(point), file.fingerprint(), 900, 900, "spoofed-provider"), MEMBER);

        verify(knowledge).saveSelected(file, List.of(point), 1, 8);
    }

    @Test
    void staleFingerprintAndInvalidEvidenceNeverReachPersistence() throws Exception {
        bookExists();
        when(text.sample(file)).thenReturn(sample);

        assertThatThrownBy(() -> service.saveBook(BOOK_ID,
                new KnowledgeDraft(List.of(point), "sha256:old", 1, 1, null), MEMBER))
                .isInstanceOf(ApiException.class).hasMessageContaining("变化");

        org.mockito.Mockito.when(ai.verifyKnowledgeSelection(List.of(point), List.of(
                new AiMetadataService.KnowledgePassage("chapter:1", BODY))))
                .thenThrow(ApiException.badRequest("INVALID_KNOWLEDGE_EVIDENCE", "引文与正文不匹配。"));
        assertThatThrownBy(() -> service.saveBook(BOOK_ID,
                new KnowledgeDraft(List.of(point), file.fingerprint(), 1, 1, null), MEMBER))
                .isInstanceOf(ApiException.class);

        verify(knowledge, never()).saveSelected(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyList(),
                org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void readsStoredPointsOnlyForTheCurrentFileAndFingerprint() throws Exception {
        bookExists();
        when(text.sample(file)).thenReturn(sample);
        var existing = new KnowledgeRepository.KnowledgeBook(BOOK_ID, "READY", "old-provider", 4, 8,
                OffsetDateTime.now(), List.of(point));
        when(knowledge.current(file)).thenReturn(Optional.of(existing));

        KnowledgeDraft result = service.readBook(BOOK_ID, MEMBER);

        assertThat(result).isEqualTo(new KnowledgeDraft(List.of(point), file.fingerprint(), 4, 8, "old-provider"));
    }

    @Test
    void clearingPointsPersistsAnEmptyListAndIgnoresClientCoverageCounts() {
        bookExists();

        service.saveBook(BOOK_ID, new KnowledgeDraft(List.of(), file.fingerprint(), 900, 900, "spoofed-provider"), MEMBER);

        verify(knowledge).saveSelected(file, List.of(), 0, 0);
        verifyNoInteractions(text);
    }
}
