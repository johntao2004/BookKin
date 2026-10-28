package com.elexvx.bookkin.ingestion.upload;

import static org.assertj.core.api.Assertions.assertThat;

import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.catalog.knowledge.KnowledgeDraft;
import com.elexvx.bookkin.ingestion.upload.BookUploadModels.MetadataDraft;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class BookUploadKnowledgeDraftRoundTripTest {
    @Test
    void selectedKnowledgeSurvivesUploadJsonAndVisibilityCopies() throws Exception {
        var points = List.of(new AiMetadataService.KnowledgePoint("认知偏差",
                "认知偏差会影响人们处理信息时的判断和决策。", "chapter:1"));
        var knowledge = new KnowledgeDraft(points, "sha256:source", 3, 12, "provider");
        var draft = new MetadataDraft("书名", null, List.of("作者"), List.of(), "zh", null, null, null,
                null, null, null, List.of(), 10, 100L, Map.of(), "作者/书名.epub", true,
                List.of(), null, null, knowledge);
        ObjectMapper json = new ObjectMapper();

        MetadataDraft reopened = json.readValue(json.writeValueAsString(draft), MetadataDraft.class);

        assertThat(reopened.knowledgeDraft()).isEqualTo(knowledge);
        assertThat(reopened.withPubliclyVisible(false).knowledgeDraft()).isEqualTo(knowledge);
    }
}
