// 用伪造引文、错误定位及格式错误作为负例，验证无依据知识不会进入图谱。
// Uses invented quotations, wrong locations and malformed output to reject ungrounded graph knowledge.
package com.elexvx.bookkin.ai;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import com.elexvx.bookkin.config.BookKinProperties;
import com.elexvx.bookkin.ingestion.upload.BookUploadRepository;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class KnowledgeEvidenceTest {
    private final AiMetadataService service = new AiMetadataService(
            new BookKinProperties(null, null, null, null, null, null, null, null, null, null,
                    new BookKinProperties.Ai(false, false, 4, Duration.ofSeconds(3), List.of(), "key")),
            mock(BookUploadRepository.class), new JsonMapper());
    @Test void rejectsInventedQuotesWrongLocationsAndConceptsMissingFromEvidence() throws Exception {
        var passages = List.of(new AiMetadataService.KnowledgePassage("page:3", "认知偏差会影响人们处理信息时的判断和决策。"));
        var points = service.verifiedKnowledge("""
                {"points":[
                  {"name":"认知偏差","quote":"认知偏差会影响人们处理信息时的判断和决策。","locator":"page:3"},
                  {"name":"认知偏差","quote":"认知偏差会影响人们处理信息时的判断和决策。","locator":"page:3"},
                  {"name":"虚构概念","quote":"认知偏差会影响人们处理信息时的判断和决策。","locator":"page:3"},
                  {"name":"认知偏差","quote":"这一段证据完全是由模型凭空编造的。","locator":"page:3"},
                  {"name":"认知偏差","quote":"认知偏差会影响人们处理信息时的判断和决策。","locator":"page:9"}
                ]}
                """, passages);
        assertEquals(1, points.size());
        assertEquals("认知偏差", points.getFirst().name());
    }
    @Test void rejectsMalformedOutputAndDoesNotCallDisabledProviders() {
        assertThrows(Exception.class, () -> service.verifiedKnowledge("{\"candidates\":[]}", List.of()));
        assertThrows(com.elexvx.bookkin.common.ApiException.class, () -> service.extractKnowledge(List.of()));
    }

    @Test void selectedKnowledgeMustBeUniqueSafeAndGroundedAndCannotExceedTenPoints() {
        var passage = new AiMetadataService.KnowledgePassage("page:3", "认知偏差会影响人们处理信息时的判断和决策。");
        var selected = new AiMetadataService.KnowledgePoint("认知偏差",
                "认知偏差会影响人们处理信息时的判断和决策。", "page:3");
        assertEquals(List.of(selected), service.verifyKnowledgeSelection(List.of(selected), List.of(passage)));
        assertThrows(com.elexvx.bookkin.common.ApiException.class,
                () -> service.verifyKnowledgeSelection(List.of(selected), List.of()));
        assertThrows(com.elexvx.bookkin.common.ApiException.class,
                () -> service.verifyKnowledgeSelection(List.of(
                        new AiMetadataService.KnowledgePoint("<script>概念</script>",
                                "认知偏差会影响人们处理信息时的判断和决策。", "page:3")), List.of(passage)));
        assertThrows(com.elexvx.bookkin.common.ApiException.class,
                () -> service.verifyKnowledgeSelection(java.util.Collections.nCopies(11, selected), List.of(passage)));
    }

    @Test void selectedKnowledgeAcceptsExactMultilineSourceQuotesButRejectsOtherControlCharacters() {
        String quote = "认知偏差会影响人们处理\n信息时的判断和决策。";
        var passage = new AiMetadataService.KnowledgePassage("chapter:1", "前文。" + quote + "后文。");
        var selected = new AiMetadataService.KnowledgePoint("认知偏差", quote, "chapter:1");

        assertEquals(List.of(selected), service.verifyKnowledgeSelection(List.of(selected), List.of(passage)));
        var nul = new AiMetadataService.KnowledgePoint("认知偏差",
                "认知偏差会影响人们\u0000处理信息时的判断和决策。", "chapter:1");
        assertThrows(com.elexvx.bookkin.common.ApiException.class,
                () -> service.verifyKnowledgeSelection(List.of(nul), List.of(passage)));
    }
}
