package io.github.johntao2004.bookkin.ingestion.upload;

import static io.github.johntao2004.bookkin.ingestion.upload.BookUploadModels.*;

import io.github.johntao2004.bookkin.ai.AiMetadataService;
import io.github.johntao2004.bookkin.ai.AiSettingsService;
import io.github.johntao2004.bookkin.audit.AuditService;
import io.github.johntao2004.bookkin.catalog.BookFormat;
import io.github.johntao2004.bookkin.catalog.DisplayCatalogService;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.config.BookKinProperties;
import io.github.johntao2004.bookkin.filemanagement.FileFingerprints;
import io.github.johntao2004.bookkin.filemanagement.FileInspector;
import io.github.johntao2004.bookkin.filemanagement.PathPolicy;
import io.github.johntao2004.bookkin.ingestion.CatalogIngestionRepository;
import io.github.johntao2004.bookkin.ingestion.ExtractedBook;
import io.github.johntao2004.bookkin.ingestion.LibraryRoot;
import io.github.johntao2004.bookkin.ingestion.LibraryRootRepository;
import io.github.johntao2004.bookkin.users.UserRepository;
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
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class BookUploadService {
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

    public BookUploadService(BookUploadRepository uploads, BookUploadProcessor processor,
                             MetadataEnrichmentService enrichment, AiMetadataService ai, AiSettingsService aiSettings, LibraryRootRepository roots,
                             CatalogIngestionRepository catalog, UserRepository users, FileInspector inspector,
                             FileFingerprints fingerprints, PathPolicy paths, BookKinProperties properties,
                             AuditService audit, ObjectMapper json, DisplayCatalogService displayCatalog) {
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
        validateDraft(requested, upload.format());
        Map<String, MetadataSource> sources = new HashMap<>(requested.sources());
        markChanges(sources, upload.draftMetadata(), requested);
        String target = paths.normalizeRelative(requested.targetPath());
        MetadataDraft normalized = new MetadataDraft(requested.title().strip(), blank(requested.subtitle()), clean(requested.authors()),
                clean(requested.translators()), blank(requested.language()), blank(requested.publisher()), blank(requested.publishedDate()),
                blank(requested.isbn()), blank(requested.description()), blank(requested.series()), requested.seriesIndex(), clean(requested.tags()),
                upload.draftMetadata().pageCount(), upload.draftMetadata().wordCount(), sources, target);
        uploads.updateDraft(id, normalized);
        audit.record(actor, "BOOK_UPLOAD_METADATA_EDITED", "BOOK_UPLOAD", id.toString(), upload.originalFilename(), target,
                upload.fingerprint(), upload.fingerprint(), "SUCCEEDED", "{}");
        return uploads.findOwned(id, actor).orElseThrow().view();
    }

    public BookUpload enrich(UUID id, Principal principal) {
        UUID actor = actor(principal);
        var upload = requireReady(owned(id, actor));
        uploads.processing(id, BookUploadStatus.ENRICHING);
        try {
            var result = enrichment.enrich(upload.draftMetadata(), aiSettings.effective().enabled(), null, false);
            uploads.ready(id, upload.encrypted(), upload.drmProtected(), upload.digitallySigned(), upload.detectedMetadata(),
                    result.draft(), result.candidates(), upload.coverCacheKey(), upload.selectedCoverSource(),
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
        uploads.processing(id, BookUploadStatus.ENRICHING);
        try {
            var result = enrichment.enrich(upload.draftMetadata(), true, providerId, true);
            uploads.ready(id, upload.encrypted(), upload.drmProtected(), upload.digitallySigned(), upload.detectedMetadata(),
                    result.draft(), result.candidates(), upload.coverCacheKey(), upload.selectedCoverSource(),
                    upload.similarBookIds().toArray(UUID[]::new));
            audit.record(actor, "BOOK_UPLOAD_AI_MATCHED", "BOOK_UPLOAD", id.toString(), upload.originalFilename(), null,
                    upload.fingerprint(), upload.fingerprint(), "SUCCEEDED", "{\"providerId\":\"" + safeAudit(providerId) + "\"}");
        } catch (Exception exception) {
            uploads.resetReady(id, "AI_MATCH_FAILED", "AI 平台暂时不可用，本地识别结果仍可继续使用。");
        }
        return uploads.findOwned(id, actor).orElseThrow().view();
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

    public BookUpload commit(UUID id, String idempotencyKey, boolean publishToDisplay, Principal principal) {
        UUID actor = actor(principal);
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 160) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED", "确认入库必须携带有效幂等键。");
        }
        var current = owned(id, actor);
        if (current.status() == BookUploadStatus.SUCCEEDED && idempotencyKey.equals(current.idempotencyKey())) {
            if (publishToDisplay && current.committedBookId() != null) displayCatalog.publish(current.committedBookId(), actor);
            return current.view();
        }
        var upload = uploads.beginCommit(id, actor, idempotencyKey);
        LibraryRoot root = writableRoot(upload.libraryRootId(), upload.declaredSizeBytes());
        Path rootPath = rootPath(root);
        Path staged = internalTarget(rootPath, upload.stagingPath());
        String normalizedTarget = paths.normalizeRelative(upload.draftMetadata().targetPath());
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
            UUID duplicate = catalog.duplicateBookId(upload.fingerprint());
            if (duplicate != null) throw new DuplicateException(duplicate);
            FileStore store = Files.getFileStore(rootPath);
            if (store.getUsableSpace() < upload.declaredSizeBytes() + 64L * 1024 * 1024) throw new IllegalArgumentException("书库可用空间不足");
            target = paths.resolveTarget(rootPath, normalizedTarget);
            if (Files.exists(target, LinkOption.NOFOLLOW_LINKS) || paths.hasCaseInsensitiveConflict(target)) throw new IllegalArgumentException("目标路径已有文件，BookKin不会覆盖它");
            ensureInternalDirectory(rootPath, target.getParent());
            Files.move(staged, target, StandardCopyOption.ATOMIC_MOVE);
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
                    draft.seriesIndex(), draft.tags(), upload.coverCacheKey(), draft.pageCount(), draft.wordCount());
            String sourcesJson = json.writeValueAsString(draft.sources());
            String[] overrides = draft.sources().entrySet().stream().filter(entry -> entry.getValue() == MetadataSource.MANUAL)
                    .map(Map.Entry::getKey).toArray(String[]::new);
            catalog.createUploaded(bookId, actor, root.id(), normalizedTarget, normalizedTarget.toLowerCase(Locale.ROOT), upload.format(),
                    attributes, upload.fingerprint(), inspection, metadata, sourcesJson, overrides, asset);
            if (publishToDisplay) displayCatalog.publish(bookId, actor);
            uploads.succeeded(id, bookId);
            cleanupEmpty(staged.getParent());
            audit.record(actor, "BOOK_UPLOAD_COMMITTED", "BOOK", bookId.toString(), upload.stagingPath(), normalizedTarget,
                    null, upload.fingerprint(), "SUCCEEDED", "{\"uploadId\":\"" + id + "\"}");
            return uploads.findOwned(id, actor).orElseThrow().view();
        } catch (DuplicateException duplicate) {
            compensate(staged, targetOrNull(rootPath, normalizedTarget), bookMoved, selectedCover, assetTarget, coverMoved);
            uploads.duplicate(id, duplicate.bookId);
            throw ApiException.conflict("DUPLICATE_BOOK", "完全相同的文件已经存在于书库中。");
        } catch (Exception exception) {
            compensate(staged, targetOrNull(rootPath, normalizedTarget), bookMoved, selectedCover, assetTarget, coverMoved);
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
            deleteUploadFiles(upload);
            uploads.expired(upload.id());
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

    private void validateDraft(MetadataDraft draft, BookFormat format) {
        if (draft == null || draft.title() == null || draft.title().isBlank() || draft.title().length() > 500) throw new IllegalArgumentException("书名不能为空且不能超过500字");
        if (draft.authors() == null || clean(draft.authors()).isEmpty() || draft.authors().size() > 20) throw new IllegalArgumentException("至少需要一位作者，最多20位");
        if (draft.translators() != null && draft.translators().size() > 20) throw new IllegalArgumentException("译者最多20位");
        if (draft.tags() != null && draft.tags().size() > 50) throw new IllegalArgumentException("标签最多50个");
        validateExtension(draft.targetPath(), format);
    }

    private void validateExtension(String path, BookFormat format) {
        if (path == null || !path.toLowerCase(Locale.ROOT).endsWith("." + format.name().toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("目标文件扩展名必须与书籍格式一致");
        }
    }

    private void markChanges(Map<String, MetadataSource> sources, MetadataDraft before, MetadataDraft after) {
        mark(sources, "title", before.title(), after.title());
        mark(sources, "subtitle", before.subtitle(), after.subtitle());
        mark(sources, "authors", before.authors(), clean(after.authors()));
        mark(sources, "translators", before.translators(), clean(after.translators()));
        mark(sources, "language", before.language(), after.language());
        mark(sources, "publisher", before.publisher(), after.publisher());
        mark(sources, "publishedDate", before.publishedDate(), after.publishedDate());
        mark(sources, "isbn", before.isbn(), after.isbn());
        mark(sources, "description", before.description(), after.description());
        mark(sources, "series", before.series(), after.series());
        mark(sources, "seriesIndex", before.seriesIndex(), after.seriesIndex());
        mark(sources, "tags", before.tags(), clean(after.tags()));
    }

    private void mark(Map<String, MetadataSource> sources, String field, Object before, Object after) {
        MetadataSource requested = sources.get(field);
        if (!Objects.equals(before, after) && requested != MetadataSource.OPEN_LIBRARY && requested != MetadataSource.GOOGLE_BOOKS
                && requested != MetadataSource.AI) {
            sources.put(field, MetadataSource.MANUAL);
        }
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
    private String blank(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private String relative(Path root, Path target) { return root.relativize(target).toString().replace('\\', '/'); }
    private String safeMessage(Exception exception) { String value = exception.getMessage(); return value == null || value.isBlank() ? "操作失败" : value.substring(0, Math.min(500, value.length())); }
    private String safeAudit(String value) {
        if (value == null) return "";
        String clean = value.replaceAll("[^a-zA-Z0-9_.-]", "");
        return clean.substring(0, Math.min(80, clean.length()));
    }
    private void deleteQuietly(Path path) { try { Files.deleteIfExists(path); } catch (Exception ignored) {} }
    private void cleanupEmpty(Path directory) { try { Files.deleteIfExists(directory); } catch (Exception ignored) {} }

    public record CoverLocation(Path path, String mimeType) {}
    private static final class DuplicateException extends RuntimeException { private final UUID bookId; private DuplicateException(UUID bookId) { this.bookId = bookId; } }
}
