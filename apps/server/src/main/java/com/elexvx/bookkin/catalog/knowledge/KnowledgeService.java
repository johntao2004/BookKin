package com.elexvx.bookkin.catalog.knowledge;

import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.catalog.BookRepository;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.infrastructure.KnowledgeTextGateway;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
// 采样后调用 AI，保存前再次比较文件身份与指纹，防止把旧正文结果附到新文件。
// Calls AI on sampled text and rechecks file identity/fingerprint before saving results against potentially changed content.
public class KnowledgeService {
    private final BookRepository books;
    private final KnowledgeRepository knowledge;
    private final KnowledgeTextGateway text;
    private final AiMetadataService ai;
    public KnowledgeService(BookRepository books, KnowledgeRepository knowledge, KnowledgeTextGateway text, AiMetadataService ai) {
        this.books = books; this.knowledge = knowledge; this.text = text; this.ai = ai;
    }
    public List<KnowledgeRepository.KnowledgeBook> list() { return knowledge.list(); }
    public void generate(UUID bookId) {
        if (!ai.hasAvailableProvider(null)) throw ApiException.badRequest("AI_UNAVAILABLE", "请先在设置中启用可用的 AI 平台，再提取正文知识点。");
        var file = books.findPreferredFile(bookId).orElseThrow(() -> ApiException.notFound("BOOK_FILE_NOT_FOUND", "书籍文件不可用。"));
        var operation = knowledge.claim(file);
        try {
            var sample = text.sample(file);
            if (sample.passages().isEmpty()) throw ApiException.badRequest("KNOWLEDGE_NO_TEXT", "没有可提取的文本；扫描版 PDF 不执行 OCR。");
            var result = ai.extractKnowledge(sample.passages().stream().map(p -> new AiMetadataService.KnowledgePassage(p.locator(), p.text())).toList());
            var current = books.findPreferredFile(bookId).orElseThrow();
            if (!current.id().equals(file.id()) || !current.fingerprint().equals(file.fingerprint())) {
                throw ApiException.conflict("KNOWLEDGE_SOURCE_CHANGED", "书籍已变化，请重新提取知识点。");
            }
            knowledge.complete(bookId, operation, result.providerId(), sample.passages().size(), sample.totalSections(), result.points());
        } catch (ApiException exception) {
            knowledge.fail(bookId, operation); throw exception;
        } catch (Exception exception) {
            knowledge.fail(bookId, operation);
            throw ApiException.badRequest("KNOWLEDGE_GENERATION_FAILED", "知识点提取失败，请检查文件是否可解析和 AI 平台配置后重试。");
        }
    }
}
