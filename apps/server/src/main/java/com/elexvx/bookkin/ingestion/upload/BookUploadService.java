package com.elexvx.bookkin.ingestion.upload;

import static com.elexvx.bookkin.ingestion.upload.BookUploadModels.*;

import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.ai.AiSettingsService;
import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.catalog.DisplayCatalogService;
import com.elexvx.bookkin.catalog.knowledge.KnowledgeDraft;
import com.elexvx.bookkin.catalog.knowledge.KnowledgeDraftService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.config.BookKinProperties;
import com.elexvx.bookkin.filemanagement.FileFingerprints;
import com.elexvx.bookkin.filemanagement.FileInspector;
import com.elexvx.bookkin.filemanagement.PathPolicy;
import com.elexvx.bookkin.filemanagement.infrastructure.BookTextSampler;
import com.elexvx.bookkin.ingestion.CatalogIngestionRepository;
import com.elexvx.bookkin.ingestion.CatalogIngestionRepository.DuplicateFingerprintException;
import com.elexvx.bookkin.ingestion.UploadedBookIngestionService;
import com.elexvx.bookkin.ingestion.ExtractedBook;
import com.elexvx.bookkin.ingestion.LibraryRoot;
import com.elexvx.bookkin.ingestion.LibraryRootRepository;
import com.elexvx.bookkin.users.UserRepository;
import tools.jackson.databind.ObjectMapper;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.Principal;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

// 协调暂存、校对和确认入库；文件落位与数据库提交之间依靠显式补偿，非单一事务。
// Coordinates staging, review and ingestion; filesystem placement and database commits use explicit compensation, not one transaction.
@Service
public class BookUploadService {
    private static final Set<String> METADATA_SOURCE_FIELDS = Set.of("title", "subtitle", "authors", "translators",
            "language", "publisher", "publishedDate", "isbn", "description", "authorBiography",
            "tableOfContents", "subjectCodes", "series", "seriesIndex", "tags");

    private final BookUploadRepository uploads;
    private final BookUploadProcessor processor;
    private final MetadataEnrichmentService enrichment;
    private final AiMetadataService ai;
    private final AiSettingsService aiSettings;
    private final LibraryRootRepository roots;
    private final CatalogIngestionRepository catalog;
    private final DisplayCatalogService displayCatalog;
    private final UserRepository users;
    private final FileInspector inspector;
    private final FileFingerprints fingerprints;
    private final PathPolicy paths;
    private final BookKinProperties properties;
    private final AuditService audit;
    private final ObjectMapper json;
    private final KnowledgeDraftService knowledgeDrafts;
    private final UploadedBookIngestionService uploadedBooks;

    @Autowired
    public BookUploadService(BookUploadRepository uploads, BookUploadProcessor processor,
                             MetadataEnrichmentService enrichment, AiMetadataService ai, AiSettingsService aiSettings, LibraryRootRepository roots,
                             CatalogIngestionRepository catalog, UserRepository users, FileInspector inspector,
                             FileFingerprints fingerprints, PathPolicy paths, BookKinProperties properties,
                             AuditService audit, ObjectMapper json, DisplayCatalogService displayCatalog,
                             KnowledgeDraftService knowledgeDrafts, UploadedBookIngestionService uploadedBooks) {
        this.uploads = uploads;
        this.processor = processor;
        this.enrichment = enrichment;
        this.ai = ai;
        this.aiSettings = aiSettings;
        this.roots = roots;
        this.catalog = catalog;
        this.displayCatalog = displayCatalog;
        this.users = users;
        this.inspector = inspector;
        this.fingerprints = fingerprints;
        this.paths = paths;
        this.properties = properties;
        this.audit = audit;
        this.json = json;
        this.knowledgeDrafts = knowledgeDrafts;
        this.uploadedBooks = uploadedBooks;
    }

    public BookUploadService(BookUploadRepository uploads, BookUploadProcessor processor,
                             MetadataEnrichmentService enrichment, AiMetadataService ai, AiSettingsService aiSettings, LibraryRootRepository roots,
                             CatalogIngestionRepository catalog, UserRepository users, FileInspector inspector,
                             FileFingerprints fingerprints, PathPolicy paths, BookKinProperties properties,
                             AuditService audit, ObjectMapper json, DisplayCatalogService displayCatalog) {
        this(uploads, processor, enrichment, ai, aiSettings, roots, catalog, users, inspector, fingerprints, paths,
                properties, audit, json, displayCatalog, null, null);
    }

    public BookUpload create(UUID rootId, String filename, long size, Principal principal) {
        UUID actor = actor(principal);
        LibraryRoot root = writableRoot(rootId, size);
        BookFormat format = format(filename);
        if (size <= 0 || size > properties.upload().maxFileSize()) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "UPLOAD_SIZE_LIMIT", "文件大小超过单本上传限制。");
        }
        UUID id = UUID.randomUUID();
        String staging = ".bookkin-staging/uploads/" + id + "/book.part";
        return uploads.create(id, actor, root.id(), basename(filename), staging, format, size,
                OffsetDateTime.now().plus(properties.upload().retention())).view();
    }

    // 逐块写入并计算哈希，完成长度校验后交给异步解析；此时尚未正式入库。
    // Streams bytes and hashes them, then starts asynchronous parsing after length checks; this is not catalog commit.
    public BookUpload receive(UUID id, long contentLength, InputStream input, Principal principal) {
        UUID actor = actor(principal);
        var upload = owned(id, actor);
        if (upload.status() != BookUploadStatus.RECEIVING) throw ApiException.conflict("UPLOAD_STATE", "当前上传会话不能再次接收文件。");
        if (contentLength != upload.declaredSizeBytes()) throw new ApiException(HttpStatus.BAD_REQUEST, "UPLOAD_LENGTH_MISMATCH", "实际上传大小与创建会话时声明的大小不一致。");
        LibraryRoot root = writableRoot(upload.libraryRootId(), contentLength);
        Path rootPath = rootPath(root);
        Path target = internalTarget(rootPath, upload.stagingPath());
        try {
            ensureInternalDirectory(rootPath, target.getParent());
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long written = 0;
            byte[] buffer = new byte[1024 * 1024];
            try (FileChannel channel = FileChannel.open(target, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
                int read;
                while ((read = input.read(buffer)) >= 0) {
                    if (read == 0) continue;
                    written += read;
                    if (written > upload.declaredSizeBytes() || written > properties.upload().maxFileSize()) throw new IllegalArgumentException("上传内容超过声明大小");
                    digest.update(buffer, 0, read);
                    ByteBuffer bytes = ByteBuffer.wrap(buffer, 0, read);
                    while (bytes.hasRemaining()) channel.write(bytes);
                }
                channel.force(true);
            }
            if (written != upload.declaredSizeBytes()) throw new IllegalArgumentException("上传文件不完整");
            String fingerprint = "sha256:" + HexFormat.of().formatHex(digest.digest());
            uploads.received(id, written, fingerprint);
            processor.process(id);
            audit.record(actor, "BOOK_UPLOAD_RECEIVED", "BOOK_UPLOAD", id.toString(), upload.originalFilename(), upload.stagingPath(),
                    null, fingerprint, "SUCCEEDED", "{\"sizeBytes\":" + written + "}");
            return uploads.findOwned(id, actor).orElseThrow().view();
        } catch (Exception exception) {
            deleteQuietly(target);
            uploads.failed(id, "UPLOAD_FAILED", safeMessage(exception));
            throw new ApiException(HttpStatus.BAD_REQUEST, "UPLOAD_FAILED", safeMessage(exception));
        }
    }

    public List<BookUpload> list(Principal principal) {
        UUID actor = actor(principal);
        return uploads.listOwned(actor).stream().map(BookUploadModels.UploadEntity::view).toList();
    }

    public BookUpload get(UUID id, Principal principal) {
        return owned(id, actor(principal)).view();
    }

    public BookUpload updateDraft(UUID id, MetadataDraft requested, Principal principal) {
        UUID actor = actor(principal);
        var upload = requireReady(owned(id, actor));
        if (requested == null) throw ApiException.badRequest("INVALID_METADATA", "书目资料格式无效。");
        String target = paths.normalizeRelative(requested.targetPath());
        validateExtension(target, upload.format());
        if (requested.title() != null && !requested.title().isBlank()) {
            target = com.elexvx.bookkin.filemanagement.BookTitleFilename.inDirectory(target, requested.title(), upload.format(), paths);
        }
        MetadataDraft sanitized = new MetadataDraft(draftTitle(requested.title()), blank(requested.subtitle()), clean(requested.authors()),
                clean(requested.translators()), blank(requested.language()), blank(requested.publisher()), blank(requested.publishedDate()),
                blank(requested.isbn()), blank(requested.description()), blank(requested.series()), requested.seriesIndex(), clean(requested.tags()),
                upload.draftMetadata().pageCount(), upload.draftMetadata().wordCount(), requested.sources(), target, requested.publiclyVisible(), com.elexvx.bookkin.catalog.ThemaSubjects.validate(requested.subjectCodes()),
                blank(requested.authorBiography()), blank(requested.tableOfContents()),
                requested.knowledgeDraft() == null ? upload.draftMetadata().knowledgeDraft() : requested.knowledgeDraft(),
                validateKnowledgeTerms(requested.knowledgeTerms() == null
                        ? upload.draftMetadata().knowledgeTerms() : requested.knowledgeTerms()));
        validateDraftSafety(sanitized, upload.format());
        if (sanitized.knowledgeDraft() != null) {
            if (knowledgeDrafts == null) throw new IllegalStateException("知识点草稿服务未配置");
            BookTextSampler.Sample knowledgeSample = sanitized.knowledgeDraft().points() == null
                    || sanitized.knowledgeDraft().points().isEmpty() ? null : sampleUploadTextForDraft(id, principal);
            knowledgeDrafts.validateUpload(sanitized.knowledgeDraft(), upload.fingerprint(), knowledgeSample);
        }
        Map<String, MetadataSource> sources = new HashMap<>(upload.draftMetadata().sources());
        markChanges(sources, upload.draftMetadata(), sanitized, requested.sources(), upload.metadataCandidates());
        MetadataDraft normalized = new MetadataDraft(sanitized.title(), sanitized.subtitle(), sanitized.authors(),
                sanitized.translators(), sanitized.language(), sanitized.publisher(), sanitized.publishedDate(), sanitized.isbn(),
                sanitized.description(), sanitized.series(), sanitized.seriesIndex(), sanitized.tags(), sanitized.pageCount(),
                sanitized.wordCount(), sources, sanitized.targetPath(), sanitized.publiclyVisible(), sanitized.subjectCodes(),
                sanitized.authorBiography(), sanitized.tableOfContents(), sanitized.knowledgeDraft(), sanitized.knowledgeTerms());
        if (!uploads.updateDraft(id, normalized)) throw ApiException.conflict("UPLOAD_STATE", "上传已开始确认入库，不能继续修改草稿。");
        audit.record(actor, "BOOK_UPLOAD_METADATA_EDITED", "BOOK_UPLOAD", id.toString(), upload.originalFilename(), target,
                upload.fingerprint(), upload.fingerprint(), "SUCCEEDED", "{}");
        return uploads.findOwned(id, actor).orElseThrow().view();
    }

    // 补全失败恢复可校对状态，保留本地识别结果供用户继续处理。
    // Enrichment failure restores the reviewable state so local extraction remains usable.
    public BookUpload enrich(UUID id, Principal principal) {
        UUID actor = actor(principal);
        var upload = requireReady(owned(id, actor));
        if (!uploads.processing(id, BookUploadStatus.ENRICHING)) throw ApiException.conflict("UPLOAD_STATE", "上传状态已变化，请重新打开草稿后重试。");
        try {
            var result = enrichment.enrich(upload.draftMetadata(), aiSettings.effective().enabled(), null, false);
            uploads.ready(id, upload.encrypted(), upload.drmProtected(), upload.digitallySigned(), upload.detectedMetadata(),
                    namedDraft(result.draft(), upload.format()).withPubliclyVisible(upload.draftMetadata().publiclyVisible()), result.candidates(), upload.coverCacheKey(), upload.selectedCoverSource(),
                    upload.similarBookIds().toArray(UUID[]::new));
        } catch (Exception exception) {
            uploads.resetReady(id, "ENRICHMENT_FAILED", "在线补全暂时不可用，本地识别结果仍可继续使用。");
        }
        return uploads.findOwned(id, actor).orElseThrow().view();
    }

    public BookUpload aiMatch(UUID id, String providerId, Principal principal) {
        UUID actor = actor(principal);
        var upload = requireReady(owned(id, actor));
        if (!ai.hasAvailableProvider(providerId)) {
            throw ApiException.conflict("AI_PROVIDER_UNAVAILABLE", "没有可用的 AI 平台，请先在服务端配置并启用至少一个平台。");
        }
        if (!uploads.processing(id, BookUploadStatus.ENRICHING)) throw ApiException.conflict("UPLOAD_STATE", "上传状态已变化，请重新打开草稿后重试。");
        try {
            var result = enrichment.enrich(upload.draftMetadata(), true, providerId, true);
            uploads.ready(id, upload.encrypted(), upload.drmProtected(), upload.digitallySigned(), upload.detectedMetadata(),
                    namedDraft(result.draft(), upload.format()).withPubliclyVisible(upload.draftMetadata().publiclyVisible()), result.candidates(), upload.coverCacheKey(), upload.selectedCoverSource(),
                    upload.similarBookIds().toArray(UUID[]::new));
            audit.record(actor, "BOOK_UPLOAD_AI_MATCHED", "BOOK_UPLOAD", id.toString(), upload.originalFilename(), null,
                    upload.fingerprint(), upload.fingerprint(), "SUCCEEDED", "{\"providerId\":\"" + safeAudit(providerId) + "\"}");
        } catch (Exception exception) {
            uploads.resetReady(id, "AI_MATCH_FAILED", "AI 平台暂时不可用，本地识别结果仍可继续使用。");
        }
        return uploads.findOwned(id, actor).orElseThrow().view();
    }

    /** Searches for book editions and persists review candidates without changing the draft. */
    public BookUpload match(UUID id, boolean refresh, String providerId, Principal principal) {
        UUID actor = actor(principal);
        requireReady(owned(id, actor));
        if (!uploads.processing(id, BookUploadStatus.ENRICHING)) {
            throw ApiException.conflict("UPLOAD_STATE", "上传状态已变化，请重新打开草稿后重试。");
        }
        try {
            // Read after the state CAS: this is the latest owned draft and can no longer be edited while matching.
            var latest = owned(id, actor);
            var result = enrichment.match(latest.draftMetadata(), providerId, refresh);
            if (result.candidates().isEmpty()) {
                String detail = result.errorDetail() == null ? "未找到匹配的版本，可修改书目资料后重试。" : result.errorDetail();
                uploads.resetReady(id, "MATCH_NO_RESULTS", detail);
                audit.record(actor, "BOOK_UPLOAD_MATCHED", "BOOK_UPLOAD", id.toString(), latest.originalFilename(), null,
                        latest.fingerprint(), latest.fingerprint(), "FAILED", "{}");
                return uploads.findOwned(id, actor).orElseThrow().view();
            }
            String errorCode = result.errorDetail() == null ? null : "MATCH_PARTIAL";
            if (!uploads.matchCompleted(id, result.candidates(), errorCode, result.errorDetail())) {
                throw ApiException.conflict("UPLOAD_STATE", "上传状态已变化，请重新打开草稿后重试。");
            }
            audit.record(actor, "BOOK_UPLOAD_MATCHED", "BOOK_UPLOAD", id.toString(), latest.originalFilename(), null,
                    latest.fingerprint(), latest.fingerprint(), errorCode == null ? "SUCCEEDED" : "PARTIAL",
                    "{\"refresh\":" + refresh + ",\"providerId\":\"" + safeAudit(providerId) + "\"}");
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            uploads.resetReady(id, "MATCH_FAILED", "在线匹配暂时不可用，可稍后重试。" + safeMessage(exception));
            audit.record(actor, "BOOK_UPLOAD_MATCHED", "BOOK_UPLOAD", id.toString(), null, null,
                    null, null, "FAILED", "{}");
        }
        return uploads.findOwned(id, actor).orElseThrow().view();
    }

    /** Reads a bounded sample from this manager's still-active upload draft without changing the staged file. */
    public BookTextSampler.Sample sampleText(UUID id, Principal principal) throws Exception {
        var source = requireTextSource(id, principal);
        try {
            return new BookTextSampler().sample(source.staged(), source.upload().format());
        } finally {
            requireUploadFingerprint(source.staged(), source.upload().fingerprint());
        }
    }

    /** Revalidates the current staged bytes after an external provider has analyzed the sampled text. */
    public void verifyTextSource(UUID id, Principal principal) {
        requireTextSource(id, principal);
    }

    private UploadTextSource requireTextSource(UUID id, Principal principal) {
        var manager = users.findByUsername(principal.getName()).orElseThrow();
        if (!manager.canManageFiles()) {
            throw ApiException.forbidden("UPLOAD_TEXT_FORBIDDEN", "只有主人或管理员可以分析上传正文。");
        }
        var upload = requireReady(owned(id, manager.id()));
        if (upload.expiresAt() == null || !upload.expiresAt().isAfter(OffsetDateTime.now())) {
            throw ApiException.conflict("UPLOAD_EXPIRED", "上传草稿已过期，无法分析正文。");
        }

        LibraryRoot root = roots.findById(upload.libraryRootId())
                .orElseThrow(() -> ApiException.notFound("LIBRARY_ROOT_NOT_FOUND", "未找到书库根目录。"));
        if (root.status() == LibraryRoot.RootStatus.OFFLINE || !root.canRead()) {
            throw ApiException.conflict("ROOT_OFFLINE", "书库根目录当前不可读取。");
        }
        Path rootPath = rootPath(root);
        Path staged = uploadStagingFile(rootPath, upload);
        long stagedSize;
        try {
            stagedSize = Files.size(staged);
        } catch (Exception exception) {
            throw ApiException.conflict("UPLOAD_FILE_MISSING", "无法读取上传暂存文件。");
        }
        if (upload.receivedBytes() != upload.declaredSizeBytes() || stagedSize != upload.declaredSizeBytes()) {
            throw ApiException.conflict("UPLOAD_FILE_CHANGED", "暂存文件大小与上传记录不一致。");
        }
        requireUploadFingerprint(staged, upload.fingerprint());
        return new UploadTextSource(upload, staged);
    }

    private MetadataDraft namedDraft(MetadataDraft draft, BookFormat format) {
        return new MetadataDraft(draft.title(), draft.subtitle(), draft.authors(), draft.translators(), draft.language(),
                draft.publisher(), draft.publishedDate(), draft.isbn(), draft.description(), draft.series(), draft.seriesIndex(),
                draft.tags(), draft.pageCount(), draft.wordCount(), draft.sources(),
                com.elexvx.bookkin.filemanagement.BookTitleFilename.inDirectory(draft.targetPath(), draft.title(), format, paths),
                draft.publiclyVisible(), draft.subjectCodes(), draft.authorBiography(), draft.tableOfContents(), draft.knowledgeDraft(),
                draft.knowledgeTerms());
    }

    private List<String> validateKnowledgeTerms(List<String> values) {
        if (values == null) return null;
        if (values.size() > 50) throw ApiException.badRequest("INVALID_METADATA_TERM_BATCH", "知识点数量不能超过 50 项。");
        var seen = new java.util.HashSet<String>();
        var result = new ArrayList<String>();
        for (String value : values) {
            String safe;
            try { safe = com.elexvx.bookkin.catalog.terms.MetadataTermText.clean(value,
                    com.elexvx.bookkin.catalog.terms.MetadataTermKind.KNOWLEDGE); }
            catch (IllegalArgumentException invalid) {
                throw ApiException.badRequest("INVALID_METADATA_TERM", "知识点词条内容无效。");
            }
            if (seen.add(com.elexvx.bookkin.catalog.terms.MetadataTermText.normalizedKey(safe))) result.add(safe);
        }
        return List.copyOf(result);
    }

    public BookUpload customCover(UUID id, byte[] input, Principal principal) {
        UUID actor = actor(principal);
        var upload = requireReady(owned(id, actor));
        return saveCover(upload, normalizeCover(input), CoverSource.CUSTOM, actor);
    }

    public BookUpload selectCover(UUID id, String candidateId, Principal principal) {
        UUID actor = actor(principal);
        var upload = requireReady(owned(id, actor));
        MetadataCandidate candidate = upload.metadataCandidates().stream().filter(value -> Objects.equals(value.id(), candidateId)).findFirst()
                .orElseThrow(() -> ApiException.notFound("COVER_CANDIDATE_NOT_FOUND", "未找到这个在线封面候选项。"));
        if (candidate.provider() == MetadataSource.AI) {
            throw ApiException.conflict("AI_COVER_NOT_VERIFIED", "AI 候选只用于书目信息核对，不能直接下载封面。");
        }
        try {
            byte[] bytes = enrichment.downloadCover(candidate, properties.upload().maxCoverSize());
            CoverSource source = candidate.provider() == MetadataSource.OPEN_LIBRARY ? CoverSource.OPEN_LIBRARY : CoverSource.GOOGLE_BOOKS;
            return saveCover(upload, normalizeCover(bytes), source, actor);
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "COVER_DOWNLOAD_FAILED", safeMessage(exception));
        }
    }

    // 幂等重放返回原结果；落位前再次检查暂存指纹、目标冲突和容量。
    // Idempotent replay returns the original result; placement rechecks staging fingerprint, destination conflicts and space.
    public BookUpload commit(UUID id, String idempotencyKey, boolean publishToDisplay, Principal principal) {
        UUID actor = actor(principal);
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 160) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED", "确认入库必须携带有效幂等键。");
        }
        var current = owned(id, actor);
        if (current.status() == BookUploadStatus.SUCCEEDED && idempotencyKey.equals(current.idempotencyKey())) {
            // 重放上传确认不能撤销之后修改的单本书公开状态。
            // A replay must not undo a later per-book visibility change.
            return current.view();
        }
        if (current.status() == BookUploadStatus.READY_FOR_REVIEW) {
            validateCommitDraft(current.draftMetadata(), current.format());
            validateUploadKnowledgeDraft(current.view(), principal);
        }
        var upload = uploads.beginCommit(id, actor, idempotencyKey);
        if (upload.status() == BookUploadStatus.SUCCEEDED && idempotencyKey.equals(upload.idempotencyKey())) return upload.view();
        try {
            validateCommitDraft(upload.draftMetadata(), upload.format());
        } catch (ApiException invalidDraft) {
            uploads.rollbackUnstartedCommit(id, idempotencyKey);
            throw invalidDraft;
        }
        LibraryRoot root = writableRoot(upload.libraryRootId(), upload.declaredSizeBytes());
        Path rootPath = rootPath(root);
        Path staged = internalTarget(rootPath, upload.stagingPath());
        String normalizedTarget = com.elexvx.bookkin.filemanagement.BookTitleFilename.inDirectory(
                upload.draftMetadata().targetPath(), upload.draftMetadata().title(), upload.format(), paths);
        validateExtension(normalizedTarget, upload.format());
        Path target;
        Path selectedCover = null;
        Path assetTarget = null;
        boolean bookMoved = false;
        boolean coverMoved = false;
        UUID bookId = UUID.randomUUID();
        try {
            if (!Files.isRegularFile(staged, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(staged)) throw new IllegalArgumentException("暂存文件不存在");
            if (!Objects.equals(fingerprints.sha256(staged), upload.fingerprint())) throw new IllegalArgumentException("暂存文件指纹已变化");
            validateUploadKnowledgeDraft(upload.view(), staged);
            UUID duplicate = catalog.duplicateBookId(upload.fingerprint());
            if (duplicate != null) throw new DuplicateFingerprintException(duplicate);
            FileStore store = Files.getFileStore(rootPath);
            if (store.getUsableSpace() < upload.declaredSizeBytes() + 64L * 1024 * 1024) throw new IllegalArgumentException("书库可用空间不足");
            target = paths.resolveTarget(rootPath, normalizedTarget);
            if (Files.exists(target, LinkOption.NOFOLLOW_LINKS) || paths.hasCaseInsensitiveConflict(target)) throw new IllegalArgumentException("目标路径已有文件，BookKin不会覆盖它");
            ensureInternalDirectory(rootPath, target.getParent());
            Files.move(staged, target);
            bookMoved = true;

            CatalogIngestionRepository.CoverAssetInput asset = null;
            if (upload.selectedCoverStagingPath() != null) {
                selectedCover = internalTarget(rootPath, upload.selectedCoverStagingPath());
                String coverFingerprint = fingerprints.sha256(selectedCover);
                assetTarget = rootPath.resolve(".bookkin-assets/covers/" + bookId + "/" + coverFingerprint.replace("sha256:", "") + ".jpg").normalize();
                ensureInternalDirectory(rootPath, assetTarget.getParent());
                Files.move(selectedCover, assetTarget, StandardCopyOption.ATOMIC_MOVE);
                coverMoved = true;
                BufferedImage image = ImageIO.read(assetTarget.toFile());
                asset = new CatalogIngestionRepository.CoverAssetInput(relative(rootPath, assetTarget), coverFingerprint,
                        "image/jpeg", image.getWidth(), image.getHeight(), upload.selectedCoverSource().name());
            }

            var inspection = inspector.inspect(target, upload.format());
            var attributes = Files.readAttributes(target, java.nio.file.attribute.BasicFileAttributes.class);
            MetadataDraft draft = upload.draftMetadata();
            ExtractedBook metadata = new ExtractedBook(draft.title(), draft.subtitle(), draft.authors(), draft.translators(),
                    draft.description(), draft.language(), draft.publisher(), draft.publishedDate(), draft.isbn(), draft.series(),
                    draft.seriesIndex(), draft.tags(), upload.coverCacheKey(), draft.pageCount(), draft.wordCount(), draft.subjectCodes(), draft.authorBiography(), draft.tableOfContents());
            String sourcesJson = json.writeValueAsString(draft.sources());
            String[] overrides = draft.sources().entrySet().stream().filter(entry -> entry.getValue() == MetadataSource.MANUAL)
                    .map(Map.Entry::getKey).toArray(String[]::new);
            if (uploadedBooks == null) {
                if (draft.knowledgeDraft() != null || draft.knowledgeTerms() != null) {
                    throw new IllegalStateException("知识词条上传入库服务未配置");
                }
                catalog.createUploaded(bookId, actor, root.id(), normalizedTarget, normalizedTarget.toLowerCase(Locale.ROOT), upload.format(),
                        attributes, upload.fingerprint(), inspection, metadata, sourcesJson, overrides, asset);
            } else {
                if (knowledgeDrafts == null && draft.knowledgeDraft() != null) throw new IllegalStateException("知识点草稿服务未配置");
                uploadedBooks.createUploaded(bookId, actor, root.id(), normalizedTarget, normalizedTarget.toLowerCase(Locale.ROOT),
                        upload.format(), attributes, upload.fingerprint(), inspection, metadata, sourcesJson, overrides, asset,
                        draft.knowledgeDraft(), draft.knowledgeTerms());
            }
            if (publishToDisplay) displayCatalog.publish(bookId, actor);
            uploads.succeeded(id, bookId);
            cleanupEmpty(staged.getParent());
            audit.record(actor, "BOOK_UPLOAD_COMMITTED", "BOOK", bookId.toString(), upload.stagingPath(), normalizedTarget,
                    null, upload.fingerprint(), "SUCCEEDED", "{\"uploadId\":\"" + id + "\"}");
            return uploads.findOwned(id, actor).orElseThrow().view();
        } catch (ApiException rejected) {
            compensate(staged, targetOrNull(rootPath, normalizedTarget), bookMoved, selectedCover, assetTarget, coverMoved);
            uploads.resetReady(id, "COMMIT_FAILED", safeMessage(rejected));
            throw rejected;
        } catch (DuplicateFingerprintException duplicate) {
            compensate(staged, targetOrNull(rootPath, normalizedTarget), bookMoved, selectedCover, assetTarget, coverMoved);
            uploads.duplicate(id, duplicate.bookId());
            throw ApiException.conflict("DUPLICATE_BOOK", "完全相同的文件已经存在于书库中。");
        } catch (Exception exception) {
            compensate(staged, targetOrNull(rootPath, normalizedTarget), bookMoved, selectedCover, assetTarget, coverMoved);
            if (isContentClaimConflict(exception)) {
                uploads.duplicate(id, catalog.duplicateBookId(upload.fingerprint()));
                throw ApiException.conflict("DUPLICATE_BOOK", "完全相同的文件已经存在于书库中。");
            }
            uploads.resetReady(id, "COMMIT_FAILED", safeMessage(exception));
            audit.record(actor, "BOOK_UPLOAD_COMMITTED", "BOOK_UPLOAD", id.toString(), upload.stagingPath(), normalizedTarget,
                    upload.fingerprint(), null, "FAILED", "{\"message\":\"commit failed\"}");
            throw new ApiException(HttpStatus.CONFLICT, "UPLOAD_COMMIT_FAILED", safeMessage(exception));
        }
    }

    public void cancel(UUID id, Principal principal) {
        UUID actor = actor(principal);
        var upload = owned(id, actor);
        if (upload.status() == BookUploadStatus.COMMITTING || upload.status() == BookUploadStatus.SUCCEEDED) {
            throw ApiException.conflict("UPLOAD_STATE", "正在入库或已经完成的上传不能取消。");
        }
        deleteUploadFiles(upload);
        uploads.cancelled(id);
        audit.record(actor, "BOOK_UPLOAD_CANCELLED", "BOOK_UPLOAD", id.toString(), upload.originalFilename(), null,
                upload.fingerprint(), null, "SUCCEEDED", "{}");
    }

    public CoverLocation cover(UUID id, Principal principal) {
        var upload = owned(id, actor(principal));
        LibraryRoot root = roots.findById(upload.libraryRootId()).orElseThrow();
        Path rootPath = rootPath(root);
        String relative = upload.selectedCoverStagingPath() != null ? upload.selectedCoverStagingPath() : upload.coverCacheKey();
        if (relative == null) throw ApiException.notFound("COVER_NOT_FOUND", "尚未生成封面。");
        Path file = relative.startsWith(".bookkin-staging/") ? internalTarget(rootPath, relative) : rootPath.resolve(relative).normalize();
        if (!file.startsWith(rootPath) || Files.isSymbolicLink(file) || !Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) {
            throw ApiException.notFound("COVER_NOT_FOUND", "封面不存在。");
        }
        return new CoverLocation(file, "image/jpeg");
    }

    @Scheduled(fixedDelayString = "1h", initialDelayString = "10m")
    public void cleanupExpired() {
        for (var upload : uploads.expired()) {
            if (uploads.expired(upload.id())) deleteUploadFiles(upload);
        }
    }

    private BookUpload saveCover(BookUploadModels.UploadEntity upload, byte[] jpeg, CoverSource source, UUID actor) {
        LibraryRoot root = writableRoot(upload.libraryRootId(), jpeg.length);
        Path rootPath = rootPath(root);
        String relative = ".bookkin-staging/uploads/" + upload.id() + "/cover.jpg";
        Path target = internalTarget(rootPath, relative);
        try {
            ensureInternalDirectory(rootPath, target.getParent());
            try (FileChannel channel = FileChannel.open(target, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE)) {
                channel.write(ByteBuffer.wrap(jpeg));
                channel.force(true);
            }
            uploads.selectCover(upload.id(), source, relative);
            audit.record(actor, "BOOK_UPLOAD_COVER_SELECTED", "BOOK_UPLOAD", upload.id().toString(), upload.originalFilename(), relative,
                    upload.fingerprint(), fingerprints.sha256(target), "SUCCEEDED", "{\"source\":\"" + source + "\"}");
            return uploads.findOwned(upload.id(), actor).orElseThrow().view();
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "COVER_SAVE_FAILED", safeMessage(exception));
        }
    }

    private byte[] normalizeCover(byte[] bytes) {
        if (bytes == null || bytes.length == 0 || bytes.length > properties.upload().maxCoverSize()) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "COVER_SIZE_LIMIT", "封面为空或超过大小限制。");
        }
        try {
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(bytes));
            if (source == null || (long) source.getWidth() * source.getHeight() > 80_000_000L || source.getWidth() > 12_000 || source.getHeight() > 12_000) {
                throw new IllegalArgumentException("封面格式不支持或像素过大");
            }
            double targetRatio = 2.0 / 3.0;
            int cropWidth = source.getWidth();
            int cropHeight = source.getHeight();
            if ((double) cropWidth / cropHeight > targetRatio) cropWidth = (int) Math.round(cropHeight * targetRatio);
            else cropHeight = (int) Math.round(cropWidth / targetRatio);
            int x = (source.getWidth() - cropWidth) / 2;
            int y = (source.getHeight() - cropHeight) / 2;
            BufferedImage target = new BufferedImage(800, 1200, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = target.createGraphics();
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.drawImage(source, 0, 0, 800, 1200, x, y, x + cropWidth, y + cropHeight, null);
            graphics.dispose();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(target, "JPEG", output);
            return output.toByteArray();
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_COVER", safeMessage(exception));
        }
    }

    private void validateDraftSafety(MetadataDraft draft, BookFormat format) {
        if (draft == null) throw ApiException.badRequest("INVALID_METADATA", "书目资料格式无效。");
        validateLength(draft.title(), 500);
        validateLength(draft.subtitle(), 500);
        validateLength(draft.language(), 1024);
        validateLength(draft.publisher(), 500);
        validateLength(draft.publishedDate(), 40);
        validateLength(draft.isbn(), 40);
        validateLength(draft.description(), 20_000);
        validateLength(draft.series(), 500);
        validateLength(draft.authorBiography(), 20_000);
        validateLength(draft.tableOfContents(), 40_000);
        validateList(draft.authors(), 20, 500);
        validateList(draft.translators(), 20, 500);
        validateList(draft.tags(), 50, 200);
        if (draft.seriesIndex() != null) {
            var seriesIndex = draft.seriesIndex().stripTrailingZeros();
            if (Math.max(0, seriesIndex.scale()) > 3 || seriesIndex.precision() - seriesIndex.scale() > 7) {
                throw ApiException.badRequest("INVALID_SERIES_INDEX", "丛书序号超出允许范围。");
            }
        }
        com.elexvx.bookkin.catalog.ThemaSubjects.validate(draft.subjectCodes());
        if (draft.sources().size() > METADATA_SOURCE_FIELDS.size()
                || draft.sources().keySet().stream().anyMatch(key -> !METADATA_SOURCE_FIELDS.contains(key))) {
            throw ApiException.badRequest("INVALID_METADATA_SOURCE", "书目来源字段无效。");
        }
        validateExtension(paths.normalizeRelative(draft.targetPath()), format);
    }

    private void validateCommitDraft(MetadataDraft draft, BookFormat format) {
        validateDraftSafety(draft, format);
        if (draft.title() == null || draft.title().isBlank()) {
            throw ApiException.badRequest("INVALID_BOOK_TITLE", "书名不能为空。");
        }
        if (clean(draft.authors()).isEmpty()) {
            throw ApiException.badRequest("INVALID_BOOK_AUTHORS", "至少需要一位作者。");
        }
    }

    private void validateUploadKnowledgeDraft(BookUpload upload, Principal principal) {
        KnowledgeDraft draft = upload.draftMetadata().knowledgeDraft();
        if (draft == null) return;
        if (knowledgeDrafts == null) throw new IllegalStateException("知识点草稿服务未配置");
        BookTextSampler.Sample sample = draft.points() == null || draft.points().isEmpty() ? null : sampleUploadTextForDraft(upload.id(), principal);
        knowledgeDrafts.validateUpload(draft, upload.fingerprint(), sample);
    }

    private BookTextSampler.Sample sampleUploadTextForDraft(UUID id, Principal principal) {
        try {
            return sampleText(id, principal);
        } catch (ApiException exception) {
            throw exception;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw ApiException.conflict("UPLOAD_FILE_CHANGED", "读取上传正文时被中断，请重新打开草稿后重试。");
        } catch (Exception exception) {
            throw ApiException.conflict("UPLOAD_FILE_CHANGED", "无法验证上传正文知识点，请重新分析后重试。");
        }
    }

    private void validateUploadKnowledgeDraft(BookUpload upload, Path staged) throws Exception {
        KnowledgeDraft draft = upload.draftMetadata().knowledgeDraft();
        if (draft == null) return;
        if (knowledgeDrafts == null) throw new IllegalStateException("知识点草稿服务未配置");
        BookTextSampler.Sample sample = null;
        if (draft.points() != null && !draft.points().isEmpty()) {
            requireUploadFingerprint(staged, upload.fingerprint());
            sample = new BookTextSampler().sample(staged, upload.format());
            requireUploadFingerprint(staged, upload.fingerprint());
        }
        knowledgeDrafts.validateUpload(draft, upload.fingerprint(), sample);
    }

    private void validateLength(String value, int max) {
        if (value != null && value.length() > max) throw ApiException.badRequest("METADATA_TOO_LONG", "书目资料超出长度限制。");
    }

    private void validateList(List<String> values, int maxItems, int maxLength) {
        if (values.size() > maxItems || values.stream().anyMatch(value -> value.length() > maxLength)) {
            throw ApiException.badRequest("METADATA_TOO_LONG", "书目资料超出长度限制。");
        }
    }

    private void validateExtension(String path, BookFormat format) {
        if (path == null || !path.toLowerCase(Locale.ROOT).endsWith("." + format.name().toLowerCase(Locale.ROOT))) {
            throw ApiException.badRequest("UPLOAD_TARGET_FORMAT_MISMATCH", "目标文件扩展名必须与书籍格式一致。");
        }
    }

    private void markChanges(Map<String, MetadataSource> sources, MetadataDraft before, MetadataDraft after,
                             Map<String, MetadataSource> requestedSources, List<MetadataCandidate> candidates) {
        mark(sources, "title", before.title(), after.title(), requestedSources, after, candidates);
        mark(sources, "subtitle", before.subtitle(), after.subtitle(), requestedSources, after, candidates);
        mark(sources, "authors", before.authors(), after.authors(), requestedSources, after, candidates);
        mark(sources, "translators", before.translators(), after.translators(), requestedSources, after, candidates);
        mark(sources, "language", before.language(), after.language(), requestedSources, after, candidates);
        mark(sources, "publisher", before.publisher(), after.publisher(), requestedSources, after, candidates);
        mark(sources, "publishedDate", before.publishedDate(), after.publishedDate(), requestedSources, after, candidates);
        mark(sources, "isbn", before.isbn(), after.isbn(), requestedSources, after, candidates);
        mark(sources, "description", before.description(), after.description(), requestedSources, after, candidates);
        mark(sources, "authorBiography", before.authorBiography(), after.authorBiography(), requestedSources, after, candidates);
        mark(sources, "tableOfContents", before.tableOfContents(), after.tableOfContents(), requestedSources, after, candidates);
        mark(sources, "subjectCodes", before.subjectCodes(), after.subjectCodes(), requestedSources, after, candidates);
        mark(sources, "series", before.series(), after.series(), requestedSources, after, candidates);
        mark(sources, "seriesIndex", before.seriesIndex(), after.seriesIndex(), requestedSources, after, candidates);
        mark(sources, "tags", before.tags(), after.tags(), requestedSources, after, candidates);
    }

    private void mark(Map<String, MetadataSource> sources, String field, Object before, Object after,
                      Map<String, MetadataSource> requestedSources, MetadataDraft draft, List<MetadataCandidate> candidates) {
        MetadataSource requested = requestedSources.get(field);
        if (Objects.equals(before, after)) {
            if (sources.get(field) == MetadataSource.MANUAL) return;
            if ((requested == MetadataSource.OPEN_LIBRARY || requested == MetadataSource.GOOGLE_BOOKS
                    || requested == MetadataSource.WIKIDATA || requested == MetadataSource.AI)
                    && matchesCandidate(field, requested, draft, candidates)) sources.put(field, requested);
            return;
        }
        if (requested != MetadataSource.OPEN_LIBRARY && requested != MetadataSource.GOOGLE_BOOKS
                && requested != MetadataSource.WIKIDATA && requested != MetadataSource.AI) {
            sources.put(field, MetadataSource.MANUAL);
            return;
        }
        sources.put(field, matchesCandidate(field, requested, draft, candidates) ? requested : MetadataSource.MANUAL);
    }

    private boolean matchesCandidate(String field, MetadataSource source, MetadataDraft draft, List<MetadataCandidate> candidates) {
        return candidates.stream().filter(candidate -> candidate.provider() == source).anyMatch(candidate -> switch (field) {
            case "title" -> blank(candidate.title()) != null && Objects.equals(blank(candidate.title()), draft.title());
            case "subtitle" -> blank(candidate.subtitle()) != null && Objects.equals(blank(candidate.subtitle()), draft.subtitle());
            case "authors" -> candidate.authors() != null && !candidate.authors().isEmpty() && clean(candidate.authors()).equals(draft.authors());
            case "language" -> blank(candidate.language()) != null && Objects.equals(blank(candidate.language()), draft.language());
            case "publisher" -> blank(candidate.publisher()) != null && Objects.equals(blank(candidate.publisher()), draft.publisher());
            case "publishedDate" -> blank(candidate.publishedDate()) != null && Objects.equals(blank(candidate.publishedDate()), draft.publishedDate());
            case "isbn" -> blank(candidate.isbn()) != null && Objects.equals(blank(candidate.isbn()), draft.isbn());
            case "description" -> blank(candidate.description()) != null && Objects.equals(blank(candidate.description()), draft.description());
            case "tags" -> candidate.tags() != null && !candidate.tags().isEmpty() && clean(candidate.tags()).equals(draft.tags());
            default -> false;
        });
    }

    private LibraryRoot writableRoot(UUID id, long requiredBytes) {
        LibraryRoot root = roots.findById(id).orElseThrow(() -> ApiException.notFound("LIBRARY_ROOT_NOT_FOUND", "未找到书库根目录。"));
        if (root.status() != LibraryRoot.RootStatus.ONLINE || !root.canWrite() || !root.canStage()) {
            throw ApiException.conflict("ROOT_READ_ONLY", "书库当前不可写或暂存区不可用。");
        }
        if (root.freeBytes() != null && root.freeBytes() < requiredBytes + 64L * 1024 * 1024) {
            throw ApiException.conflict("INSUFFICIENT_SPACE", "书库剩余空间不足。");
        }
        return root;
    }

    private Path rootPath(LibraryRoot root) {
        try { return Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath()).toRealPath(); }
        catch (Exception exception) { throw ApiException.conflict("ROOT_OFFLINE", "书库根目录暂时不可访问。"); }
    }

    private Path internalTarget(Path root, String relative) {
        if (relative == null || !(relative.startsWith(".bookkin-staging/uploads/") || relative.startsWith(".bookkin-assets/covers/"))) {
            throw new IllegalArgumentException("内部路径无效");
        }
        Path target = root.resolve(relative).normalize();
        if (!target.startsWith(root)) throw new IllegalArgumentException("内部路径越过书库");
        return target;
    }

    private Path uploadStagingFile(Path root, BookUploadModels.UploadEntity upload) {
        String expectedRelative = ".bookkin-staging/uploads/" + upload.id() + "/book.part";
        if (!expectedRelative.equals(upload.stagingPath())) {
            throw ApiException.conflict("UPLOAD_STAGING_PATH_INVALID", "上传暂存路径与会话不匹配。");
        }
        Path staged = internalTarget(root, expectedRelative);
        Path current = root;
        for (Path segment : root.relativize(staged)) {
            current = current.resolve(segment);
            if (Files.isSymbolicLink(current)) {
                throw ApiException.conflict("UPLOAD_STAGING_PATH_INVALID", "上传暂存路径不能包含软链接。");
            }
        }
        if (!Files.isRegularFile(staged, LinkOption.NOFOLLOW_LINKS) || !Files.isReadable(staged)) {
            throw ApiException.conflict("UPLOAD_FILE_MISSING", "上传暂存文件不存在或不可读取。");
        }
        return staged;
    }

    private void requireUploadFingerprint(Path staged, String expectedFingerprint) {
        if (expectedFingerprint == null || expectedFingerprint.isBlank()) {
            throw ApiException.conflict("UPLOAD_FILE_CHANGED", "上传记录缺少文件指纹。");
        }
        try {
            if (!expectedFingerprint.equals(fingerprints.sha256(staged))) {
                throw ApiException.conflict("UPLOAD_FILE_CHANGED", "暂存文件指纹与上传记录不一致。");
            }
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw ApiException.conflict("UPLOAD_FILE_MISSING", "无法读取上传暂存文件。");
        }
    }

    private record UploadTextSource(BookUploadModels.UploadEntity upload, Path staged) {}

    private void ensureInternalDirectory(Path root, Path directory) throws Exception {
        Path relative = root.relativize(directory.normalize());
        Path current = root;
        for (Path segment : relative) {
            current = current.resolve(segment);
            if (Files.exists(current, LinkOption.NOFOLLOW_LINKS)) {
                if (Files.isSymbolicLink(current) || !Files.isDirectory(current, LinkOption.NOFOLLOW_LINKS)) throw new IllegalArgumentException("目标目录不安全");
            } else Files.createDirectory(current);
            if (!current.toRealPath().startsWith(root)) throw new IllegalArgumentException("目标目录越过书库");
        }
    }

    // 补偿尝试把已移动内容退回暂存区；不能把此过程视作数据库原子回滚。
    // Compensation attempts to return moved content to staging; it is not an atomic database rollback.
    private void compensate(Path staged, Path target, boolean bookMoved, Path stagedCover, Path asset, boolean coverMoved) {
        try { if (bookMoved && target != null && Files.exists(target) && !Files.exists(staged)) Files.move(target, staged, StandardCopyOption.ATOMIC_MOVE); }
        catch (Exception ignored) {}
        try { if (coverMoved && asset != null && stagedCover != null && Files.exists(asset) && !Files.exists(stagedCover)) Files.move(asset, stagedCover, StandardCopyOption.ATOMIC_MOVE); }
        catch (Exception ignored) {}
    }

    private Path targetOrNull(Path root, String relative) {
        try { return root.resolve(paths.normalizeRelative(relative)).normalize(); }
        catch (Exception ignored) { return null; }
    }

    private void deleteUploadFiles(BookUploadModels.UploadEntity upload) {
        try {
            LibraryRoot root = roots.findById(upload.libraryRootId()).orElseThrow();
            Path rootPath = rootPath(root);
            Path directory = internalTarget(rootPath, ".bookkin-staging/uploads/" + upload.id());
            if (Files.isDirectory(directory, LinkOption.NOFOLLOW_LINKS) && !Files.isSymbolicLink(directory)) {
                try (var stream = Files.list(directory)) { for (Path file : stream.toList()) deleteQuietly(file); }
                Files.deleteIfExists(directory);
            }
        } catch (Exception ignored) {}
    }

    private BookUploadModels.UploadEntity owned(UUID id, UUID actor) {
        return uploads.findOwned(id, actor).orElseThrow(() -> ApiException.notFound("UPLOAD_NOT_FOUND", "未找到这个上传会话。"));
    }

    private BookUploadModels.UploadEntity requireReady(BookUploadModels.UploadEntity upload) {
        if (upload.status() != BookUploadStatus.READY_FOR_REVIEW) throw ApiException.conflict("UPLOAD_STATE", "书籍尚未进入可校对状态。");
        return upload;
    }

    private UUID actor(Principal principal) { return users.findByUsername(principal.getName()).orElseThrow().id(); }
    private BookFormat format(String filename) {
        String lower = basename(filename).toLowerCase(Locale.ROOT);
        if (lower.endsWith(".epub")) return BookFormat.EPUB;
        if (lower.endsWith(".pdf")) return BookFormat.PDF;
        throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_BOOK_FORMAT", "只支持 EPUB 和 PDF，不支持压缩包。");
    }
    private String basename(String value) {
        if (value == null || value.isBlank() || value.indexOf('\0') >= 0) throw new IllegalArgumentException("文件名无效");
        String name = value.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).strip();
        if (name.isBlank() || name.length() > 500) throw new IllegalArgumentException("文件名无效");
        return name;
    }
    private List<String> clean(List<String> values) { return values == null ? List.of() : values.stream().filter(value -> value != null && !value.isBlank()).map(String::strip).distinct().toList(); }
    private String draftTitle(String value) { return value == null ? "" : value.strip(); }
    private String blank(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private String relative(Path root, Path target) { return root.relativize(target).toString().replace('\\', '/'); }
    private static boolean isContentClaimConflict(Throwable error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql && "23505".equals(sql.getSQLState())
                    && sql.getMessage() != null && sql.getMessage().contains("DUPLICATE_FINGERPRINT")) return true;
        }
        return false;
    }

    private String safeMessage(Exception exception) { String value = exception.getMessage(); return value == null || value.isBlank() ? "操作失败" : value.substring(0, Math.min(500, value.length())); }
    private String safeAudit(String value) {
        if (value == null) return "";
        String clean = value.replaceAll("[^a-zA-Z0-9_.-]", "");
        return clean.substring(0, Math.min(80, clean.length()));
    }
    private void deleteQuietly(Path path) { try { Files.deleteIfExists(path); } catch (Exception ignored) {} }
    private void cleanupEmpty(Path directory) { try { Files.deleteIfExists(directory); } catch (Exception ignored) {} }

    public record CoverLocation(Path path, String mimeType) {}
}
