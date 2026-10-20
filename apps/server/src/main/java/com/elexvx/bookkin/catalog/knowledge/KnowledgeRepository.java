package com.elexvx.bookkin.catalog.knowledge;

import com.elexvx.bookkin.ai.AiMetadataService.KnowledgePoint;
import com.elexvx.bookkin.catalog.BookFile;
import com.elexvx.bookkin.common.ApiException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

@Repository
// 记录提取任务和有出处的知识点，使用任务标识协调完成或失败结果。
// Stores extraction jobs and sourced knowledge points, using operation identifiers to coordinate completion/failure.
public class KnowledgeRepository {
    private final DSLContext dsl;
    private final ObjectMapper json;
    public KnowledgeRepository(DSLContext dsl, ObjectMapper json) { this.dsl = dsl; this.json = json; }

    public List<KnowledgeBook> list() {
        return dsl.fetch("""
                select k.*, k.points::text as points_text from book_knowledge k
                join book_files f on f.id = k.file_id and f.book_id = k.book_id
                where f.status = 'AVAILABLE' and f.fingerprint = k.fingerprint
                  and f.id = (select preferred.id from book_files preferred
                    where preferred.book_id = k.book_id and preferred.status = 'AVAILABLE'
                    order by case preferred.format when 'EPUB' then 0 else 1 end, preferred.id limit 1)
                order by k.book_id
                """).map(row -> {
            var points = new ArrayList<KnowledgePoint>();
            try {
                for (var point : json.readTree(row.get("points_text", String.class))) {
                    points.add(new KnowledgePoint(point.path("name").asText(), point.path("quote").asText(), point.path("locator").asText()));
                }
            } catch (Exception invalid) { throw new IllegalStateException("知识点存储格式无效", invalid); }
            String status = row.get("status", String.class);
            if ("GENERATING".equals(status) && row.get("started_at", OffsetDateTime.class).isBefore(OffsetDateTime.now().minusMinutes(5))) status = "FAILED";
            return new KnowledgeBook(row.get("book_id", UUID.class), status,
                    row.get("provider_id", String.class), row.get("sampled_sections", Integer.class),
                    row.get("total_sections", Integer.class), row.get("generated_at", OffsetDateTime.class), List.copyOf(points));
        });
    }

    public UUID claim(BookFile file) {
        UUID operation = UUID.randomUUID();
        int updated = dsl.execute("""
                insert into book_knowledge(book_id, file_id, fingerprint, status, operation_id)
                values (?, ?, ?, 'GENERATING', ?)
                on conflict (book_id) do update set file_id = excluded.file_id, fingerprint = excluded.fingerprint,
                    status = 'GENERATING', operation_id = excluded.operation_id, started_at = now(),
                    points = case when book_knowledge.fingerprint = excluded.fingerprint then book_knowledge.points else '[]'::jsonb end
                where book_knowledge.status <> 'GENERATING' or book_knowledge.started_at < now() - interval '5 minutes'
                """, file.bookId(), file.id(), file.fingerprint(), operation);
        if (updated == 0) throw ApiException.conflict("KNOWLEDGE_BUSY", "这本书正在提取知识点，请稍后刷新。");
        return operation;
    }
    public void complete(UUID bookId, UUID operation, String provider, int samples, int total, List<KnowledgePoint> points) throws Exception {
        int updated = dsl.execute("""
                update book_knowledge set status = 'READY', provider_id = ?, sampled_sections = ?, total_sections = ?,
                    points = ?::jsonb, generated_at = now() where book_id = ? and operation_id = ? and status = 'GENERATING'
                """, provider, samples, total, json.writeValueAsString(points), bookId, operation);
        if (updated != 1) throw ApiException.conflict("KNOWLEDGE_SUPERSEDED", "提取任务已被更新，请刷新图谱。");
    }
    public void fail(UUID bookId, UUID operation) {
        dsl.execute("update book_knowledge set status = 'FAILED' where book_id = ? and operation_id = ?", bookId, operation);
    }
    public record KnowledgeBook(UUID bookId, String status, String providerId, int sampledSections, int totalSections,
                                OffsetDateTime generatedAt, List<KnowledgePoint> points) {}
}
