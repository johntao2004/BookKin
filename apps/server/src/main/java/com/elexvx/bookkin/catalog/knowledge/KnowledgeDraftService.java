package com.elexvx.bookkin.catalog.knowledge;

import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.auth.RolePermissionService;
import com.elexvx.bookkin.catalog.BookFile;
import com.elexvx.bookkin.catalog.BookFileStatus;
import com.elexvx.bookkin.catalog.BookRepository;
import com.elexvx.bookkin.catalog.terms.MetadataTermService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.infrastructure.BookTextSampler;
import com.elexvx.bookkin.filemanagement.infrastructure.KnowledgeTextGateway;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Validates and persists user-adopted, source-grounded knowledge points. */
@Service
public class KnowledgeDraftService {
    private final BookRepository books;
    private final KnowledgeRepository knowledge;
    private final KnowledgeTextGateway text;
    private final AiMetadataService ai;
    private final RolePermissionService permissions;
    private final MetadataTermService terms;

    @Autowired
    public KnowledgeDraftService(BookRepository books, KnowledgeRepository knowledge, KnowledgeTextGateway text,
                                 AiMetadataService ai, RolePermissionService permissions, MetadataTermService terms) {
        this.books = books;
        this.knowledge = knowledge;
        this.text = text;
        this.ai = ai;
        this.permissions = permissions;
        this.terms = terms;
    }

    public KnowledgeDraftService(BookRepository books, KnowledgeRepository knowledge, KnowledgeTextGateway text,
                                 AiMetadataService ai, RolePermissionService permissions) {
        this(books, knowledge, text, ai, permissions, null);
    }

    public KnowledgeDraft readBook(UUID bookId, Principal principal) {
        authorizeRead(principal);
        BookFile before = currentFile(bookId);
        verifyFile(before);
        BookFile current = currentFile(bookId);
        sameFile(before, current);
        var saved = knowledge.current(current);
        return saved.map(value -> new KnowledgeDraft(value.points(), current.fingerprint(), value.sampledSections(),
                        value.totalSections(), value.providerId()))
                .orElseGet(() -> new KnowledgeDraft(List.of(), current.fingerprint(), 0, 0, null));
    }

    /** Saves an explicitly submitted metadata edit and rechecks permission, bytes, and evidence in the transaction. */
    @Transactional
    public void saveBook(UUID bookId, KnowledgeDraft draft, Principal principal) {
        authorizeBook(principal);
        saveBookDraft(bookId, draft, principal);
    }

    /** Called inside the authenticated upload commit transaction after its book and file rows exist. */
    @Transactional
    public void saveUploadedBook(UUID bookId, KnowledgeDraft draft) {
        saveBookDraft(bookId, draft, null);
    }

    private void saveBookDraft(UUID bookId, KnowledgeDraft draft, Principal principal) {
        BookFile before = currentFile(bookId);
        List<AiMetadataService.KnowledgePoint> points;
        int sampled = 0;
        int total = 0;
        if (draft == null) throw ApiException.badRequest("INVALID_KNOWLEDGE_DRAFT", "知识点草稿格式无效。");
        if (draft.points() == null) throw ApiException.badRequest("INVALID_KNOWLEDGE_POINTS", "知识点列表格式无效。");
        requireFingerprint(draft.fingerprint(), before.fingerprint());
        if (draft.points().isEmpty()) {
            points = List.of();
        } else {
            BookTextSampler.Sample sample = sample(before);
            points = validateSelection(draft, before.fingerprint(), sample);
            sampled = sample.passages().size();
            total = Math.max(sample.totalSections(), sampled);
        }
        if (principal != null) authorizeBook(principal);
        BookFile after = currentFile(bookId);
        sameFile(before, after);
        knowledge.saveSelected(after, points, sampled, total);
        if (terms != null) terms.registerKnowledgePoints(points);
    }

    /** Persists completed evidence points and their reusable vocabulary names atomically. */
    @Transactional
    public void completeGenerated(UUID bookId, UUID operation, String provider, int sampledSections, int totalSections,
                                  List<AiMetadataService.KnowledgePoint> points) throws Exception {
        knowledge.complete(bookId, operation, provider, sampledSections, totalSections, points);
        if (terms != null) terms.registerKnowledgePoints(points);
    }

    /** Uploads use the same validation rules while their authorized caller owns access to the staging file. */
    public List<AiMetadataService.KnowledgePoint> validateUpload(KnowledgeDraft draft, String expectedFingerprint,
                                                                   BookTextSampler.Sample sample) {
        if (draft == null) return null;
        if (draft.points() == null) throw ApiException.badRequest("INVALID_KNOWLEDGE_POINTS", "知识点列表格式无效。");
        requireFingerprint(draft.fingerprint(), expectedFingerprint);
        if (draft.points().isEmpty()) return List.of();
        if (sample == null || sample.passages().isEmpty()) {
            throw ApiException.conflict("KNOWLEDGE_SOURCE_CHANGED", "当前正文不再包含可验证的知识点证据，请重新分析。");
        }
        return verifyPoints(draft.points(), sample);
    }

    private List<AiMetadataService.KnowledgePoint> validateSelection(KnowledgeDraft draft, String fingerprint,
                                                                       BookTextSampler.Sample sample) {
        requireFingerprint(draft.fingerprint(), fingerprint);
        if (sample.passages().isEmpty()) {
            throw ApiException.conflict("KNOWLEDGE_SOURCE_CHANGED", "当前正文不再包含可验证的知识点证据，请重新分析。");
        }
        return verifyPoints(draft.points(), sample);
    }

    private List<AiMetadataService.KnowledgePoint> verifyPoints(List<AiMetadataService.KnowledgePoint> points,
                                                                  BookTextSampler.Sample sample) {
        var passages = sample.passages().stream()
                .map(passage -> new AiMetadataService.KnowledgePassage(passage.locator(), passage.text())).toList();
        return ai.verifyKnowledgeSelection(points, passages);
    }

    private BookTextSampler.Sample sample(BookFile file) {
        try {
            return text.sample(file);
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw ApiException.conflict("KNOWLEDGE_SOURCE_CHANGED", "无法读取当前正文，请重新打开书目后重试。");
        }
    }

    private void verifyFile(BookFile file) {
        try {
            text.verify(file);
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw ApiException.conflict("KNOWLEDGE_SOURCE_CHANGED", "无法验证当前正文文件，请重新打开书目后重试。");
        }
    }

    private BookFile currentFile(UUID bookId) {
        if (!books.exists(bookId)) throw ApiException.notFound("BOOK_NOT_FOUND", "书籍不存在。");
        return books.findPreferredFile(bookId)
                .filter(file -> file.bookId().equals(bookId) && file.status() == BookFileStatus.AVAILABLE)
                .orElseThrow(() -> ApiException.notFound("BOOK_FILE_NOT_FOUND", "没有可读取的普通书籍文件。"));
    }

    private void authorizeBook(Principal principal) {
        permissions.require(principal, "reader.read");
        permissions.require(principal, "library.edit");
    }

    private void authorizeRead(Principal principal) {
        permissions.require(principal, "knowledge.view");
        permissions.require(principal, "reader.read");
    }

    private void requireFingerprint(String supplied, String expected) {
        if (supplied == null || supplied.isBlank() || expected == null || !supplied.equals(expected)) {
            throw ApiException.conflict("KNOWLEDGE_SOURCE_CHANGED", "正文已变化，请重新分析知识点后再保存。");
        }
    }

    private void sameFile(BookFile before, BookFile after) {
        if (after == null || after.status() != BookFileStatus.AVAILABLE || !before.id().equals(after.id())
                || !before.fingerprint().equals(after.fingerprint())) {
            throw ApiException.conflict("KNOWLEDGE_SOURCE_CHANGED", "正文已变化，请重新分析知识点后再保存。");
        }
    }
}
