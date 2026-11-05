package com.elexvx.silvae.catalog;

import java.security.Principal;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MetadataEditingService {
    private final BookMetadataRepository metadata;
    private final DisplayCatalogService display;
    private final com.elexvx.silvae.filemanagement.BookTitleFileService filenames;
    private final com.elexvx.silvae.catalog.knowledge.KnowledgeDraftService knowledgeDrafts;
    private final com.elexvx.silvae.catalog.terms.MetadataTermService terms;
    @Autowired
    public MetadataEditingService(BookMetadataRepository metadata, DisplayCatalogService display,
                                  com.elexvx.silvae.filemanagement.BookTitleFileService filenames,
                                  com.elexvx.silvae.catalog.knowledge.KnowledgeDraftService knowledgeDrafts,
                                  com.elexvx.silvae.catalog.terms.MetadataTermService terms) {
        this.metadata = metadata; this.display = display; this.filenames = filenames; this.knowledgeDrafts = knowledgeDrafts;
        this.terms = terms;
    }
    public MetadataEditingService(BookMetadataRepository metadata, DisplayCatalogService display,
                                  com.elexvx.silvae.filemanagement.BookTitleFileService filenames,
                                  com.elexvx.silvae.catalog.knowledge.KnowledgeDraftService knowledgeDrafts) {
        this(metadata, display, filenames, knowledgeDrafts, null);
    }
    public MetadataEditingService(BookMetadataRepository metadata, DisplayCatalogService display,
                                  com.elexvx.silvae.filemanagement.BookTitleFileService filenames) {
        this(metadata, display, filenames, null);
    }
    // 书目修改和公开状态在同一数据库事务中保存。
    /** Bibliographic edits and public visibility are saved as one database transaction. */
    // 数据库书目信息与公开状态一起提交；文件名同步参与同一事务；原文件内容写回走独立文件操作流程。
    // Bibliographic data and visibility commit together in the database; filename synchronization participates in this transaction; content writeback uses the separate file-operation flow.
    @Transactional
    public void update(UUID bookId, BookMetadataRepository.MetadataPatch patch, Boolean publiclyVisible, Principal principal) {
        update(bookId, patch, publiclyVisible, null, null, principal);
    }

    @Transactional
    public void update(UUID bookId, BookMetadataRepository.MetadataPatch patch, Boolean publiclyVisible,
                       com.elexvx.silvae.catalog.knowledge.KnowledgeDraft knowledgeDraft, Principal principal) {
        update(bookId, patch, publiclyVisible, knowledgeDraft, null, principal);
    }

    @Transactional
    public void update(UUID bookId, BookMetadataRepository.MetadataPatch patch, Boolean publiclyVisible,
                       com.elexvx.silvae.catalog.knowledge.KnowledgeDraft knowledgeDraft,
                       java.util.List<String> knowledgeTerms, Principal principal) {
        BookMetadataRepository.MetadataPatch normalized = terms == null ? patch : terms.canonicalizeMetadataTerms(patch);
        metadata.update(bookId, normalized);
        if (publiclyVisible != null) display.setVisibility(bookId, publiclyVisible, principal);
        if (terms != null) {
            if (normalized.manualFields() != null && java.util.Arrays.asList(normalized.manualFields()).contains("language")
                    && normalized.language() != null) {
                terms.ensureLanguages(normalized.language());
            }
            if (knowledgeTerms != null) terms.saveBookKnowledgeTerms(bookId, knowledgeTerms, principal);
        } else if (knowledgeTerms != null) {
            throw new IllegalStateException("元数据词库服务未配置");
        }
        if (knowledgeDraft != null) {
            if (knowledgeDrafts == null) throw new IllegalStateException("知识点草稿服务未配置");
            knowledgeDrafts.saveBook(bookId, knowledgeDraft, principal);
        }
        var saved = metadata.find(bookId).orElseThrow();
        filenames.synchronize(bookId, saved.title(), principal);
    }
}
