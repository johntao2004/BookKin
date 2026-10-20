// 验证禁用 AI 不读取文件、失败不覆盖旧知识，以及成功结果保留真实引文与采样范围。
// Checks that disabled AI reads no files, failures preserve prior knowledge and success retains real evidence/sample coverage.
package com.elexvx.bookkin.catalog.knowledge;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.catalog.*;
import com.elexvx.bookkin.filemanagement.infrastructure.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class KnowledgeServiceTest {
    final BookRepository books = mock(BookRepository.class);
    final KnowledgeRepository store = mock(KnowledgeRepository.class);
    final KnowledgeTextGateway text = mock(KnowledgeTextGateway.class);
    final AiMetadataService ai = mock(AiMetadataService.class);
    final KnowledgeService service = new KnowledgeService(books, store, text, ai);
    final UUID id = UUID.randomUUID();
    final UUID operation = UUID.randomUUID();
    final BookFile file = new BookFile(UUID.randomUUID(), id, UUID.randomUUID(), "book.pdf", BookFormat.PDF,
            BookFileStatus.AVAILABLE, 10, null, "sha256:test", false, false, false);
    void prepare() {
        when(ai.hasAvailableProvider(null)).thenReturn(true);
        when(books.findPreferredFile(id)).thenReturn(Optional.of(file));
        when(store.claim(file)).thenReturn(operation);
    }
    @Test void unavailableAiDoesNotClaimOrReadFiles() {
        assertThrows(Exception.class, () -> service.generate(id));
        verifyNoInteractions(store, text);
    }
    @Test void extractionFailureMarksTheJobFailedWithoutReplacingPriorPoints() throws Exception {
        prepare(); when(text.sample(file)).thenThrow(new java.io.IOException("unreadable"));
        assertThrows(Exception.class, () -> service.generate(id));
        verify(store).fail(id, operation); verify(store, never()).complete(any(), any(), any(), anyInt(), anyInt(), any());
    }
    @Test void persistsGroundedPointsAndActualSampleCoverage() throws Exception {
        prepare();
        var passages = List.of(new BookTextSampler.Passage("page:1", "正文证据说明认知偏差会影响人们决策。"));
        when(text.sample(file)).thenReturn(new BookTextSampler.Sample(passages, 100));
        var points = List.of(new AiMetadataService.KnowledgePoint("认知偏差", passages.getFirst().text(), "page:1"));
        when(ai.extractKnowledge(any())).thenReturn(new AiMetadataService.KnowledgeResult("local", points));
        service.generate(id);
        verify(store).complete(id, operation, "local", 1, 100, points);
    }
}
