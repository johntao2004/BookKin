package com.elexvx.bookkin.catalog.knowledge;

import com.elexvx.bookkin.ai.AiMetadataService.KnowledgePoint;
import java.util.List;

/** Source-grounded knowledge point candidates returned for an explicit editing decision. */
public record KnowledgeDraft(List<KnowledgePoint> points, String fingerprint, int sampledSections,
                             int totalSections, String providerId) {
    public KnowledgeDraft {
        if (points != null) points = List.copyOf(points);
    }
}
