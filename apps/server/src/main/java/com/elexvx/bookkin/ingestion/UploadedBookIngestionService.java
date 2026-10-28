package com.elexvx.bookkin.ingestion;

import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.catalog.knowledge.KnowledgeDraft;
import com.elexvx.bookkin.catalog.knowledge.KnowledgeDraftService;
import com.elexvx.bookkin.catalog.terms.MetadataTermService;
import com.elexvx.bookkin.filemanagement.FileInspector.Inspection;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Atomically creates an uploaded catalog record and attaches its validated knowledge draft. */
@Service
public class UploadedBookIngestionService {
    private final CatalogIngestionRepository catalog;
    private final KnowledgeDraftService knowledge;
    private final MetadataTermService terms;

    @Autowired
    public UploadedBookIngestionService(CatalogIngestionRepository catalog, KnowledgeDraftService knowledge,
                                       MetadataTermService terms) {
        this.catalog = catalog;
        this.knowledge = knowledge;
        this.terms = terms;
    }

    public UploadedBookIngestionService(CatalogIngestionRepository catalog, KnowledgeDraftService knowledge) {
        this(catalog, knowledge, null);
    }

    @Transactional
    public UUID createUploaded(UUID bookId, UUID actorId, UUID rootId, String relativePath, String normalizedPath,
                               BookFormat format, BasicFileAttributes attributes, String fingerprint,
                               Inspection inspection, ExtractedBook metadata, String metadataSourcesJson,
                               String[] manualOverrides, CatalogIngestionRepository.CoverAssetInput coverAsset,
                               KnowledgeDraft knowledgeDraft) {
        return createUploaded(bookId, actorId, rootId, relativePath, normalizedPath, format, attributes, fingerprint,
                inspection, metadata, metadataSourcesJson, manualOverrides, coverAsset, knowledgeDraft, null);
    }

    @Transactional
    public UUID createUploaded(UUID bookId, UUID actorId, UUID rootId, String relativePath, String normalizedPath,
                               BookFormat format, BasicFileAttributes attributes, String fingerprint,
                               Inspection inspection, ExtractedBook metadata, String metadataSourcesJson,
                               String[] manualOverrides, CatalogIngestionRepository.CoverAssetInput coverAsset,
                               KnowledgeDraft knowledgeDraft, java.util.List<String> knowledgeTerms) {
        ExtractedBook canonicalMetadata = metadata;
        if (terms != null) {
            canonicalMetadata = metadata.withCatalogTerms(terms.canonicalSeries(metadata.series()), terms.canonicalTags(metadata.tags()));
        }
        if (terms == null && knowledgeTerms != null) throw new IllegalStateException("元数据词库服务未配置");
        if (knowledge == null && knowledgeDraft != null) throw new IllegalStateException("知识点草稿服务未配置");
        UUID result = catalog.createUploaded(bookId, actorId, rootId, relativePath, normalizedPath, format,
                attributes, fingerprint, inspection, canonicalMetadata, metadataSourcesJson, manualOverrides, coverAsset);
        if (terms != null) {
            terms.ensureLanguages(canonicalMetadata.language());
            terms.saveUploadedBookKnowledgeTerms(bookId, knowledgeTerms);
        }
        if (knowledgeDraft != null) knowledge.saveUploadedBook(bookId, knowledgeDraft);
        return result;
    }
}
