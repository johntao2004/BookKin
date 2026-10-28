package com.elexvx.bookkin.ai;

import com.elexvx.bookkin.auth.RolePermissionService;
import com.elexvx.bookkin.catalog.BookFile;
import com.elexvx.bookkin.catalog.BookFileStatus;
import com.elexvx.bookkin.catalog.BookRepository;
import com.elexvx.bookkin.catalog.knowledge.KnowledgeDraft;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.infrastructure.BookTextSampler;
import com.elexvx.bookkin.filemanagement.infrastructure.KnowledgeTextGateway;
import com.elexvx.bookkin.ingestion.upload.BookUploadModels.BookUpload;
import com.elexvx.bookkin.ingestion.upload.BookUploadModels.BookUploadStatus;
import com.elexvx.bookkin.ingestion.upload.BookUploadService;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRole;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Consent-based knowledge point preview. This service never writes graph or metadata state. */
@Service
public class AiBookKnowledgeService {
    private record SourceText(BookTextSampler.Sample sample, String fingerprint, String version) {}
    private record Attempt(long started, boolean running) {}

    private final AiMetadataService ai;
    private final RolePermissionService permissions;
    private final BookRepository books;
    private final KnowledgeTextGateway text;
    private final BookUploadService uploads;
    private final ConcurrentHashMap<UUID, Attempt> attempts = new ConcurrentHashMap<>();

    public AiBookKnowledgeService(AiMetadataService ai, RolePermissionService permissions, BookRepository books,
                                  KnowledgeTextGateway text, BookUploadService uploads) {
        this.ai = ai;
        this.permissions = permissions;
        this.books = books;
        this.text = text;
        this.uploads = uploads;
    }

    public KnowledgeDraft generate(AiBookKnowledgeController.Input input, Principal principal) throws Exception {
        if (!input.consent()) throw ApiException.badRequest("AI_CONSENT_REQUIRED", "请确认将采样正文发送给已配置的 AI 平台。");
        BookKinUser actor = authorize(input.source(), principal);
        Attempt attempt = acquire(actor.id());
        try {
            if (!ai.hasAvailableProvider(null)) {
                throw ApiException.badRequest("AI_UNAVAILABLE", "请先在 AI 设置中启用并配置平台。");
            }
            SourceText source = load(input.source(), input.id(), principal);
            if (source.sample().passages().isEmpty()) {
                throw ApiException.badRequest("AI_SOURCE_EMPTY", "没有可读取的正文；扫描件暂不支持 OCR。");
            }
            var passages = source.sample().passages().stream()
                    .map(passage -> new AiMetadataService.KnowledgePassage(passage.locator(), passage.text())).toList();
            AiMetadataService.KnowledgeResult generated = ai.extractKnowledge(passages);

            authorize(input.source(), principal);
            SourceText current = load(input.source(), input.id(), principal);
            if (!source.version().equals(current.version())) {
                throw ApiException.conflict("AI_SOURCE_CHANGED", "正文已更新，请重新分析知识点。");
            }
            return new KnowledgeDraft(generated.points(), source.fingerprint(), source.sample().passages().size(),
                    Math.max(source.sample().totalSections(), source.sample().passages().size()), generated.providerId());
        } finally {
            attempts.replace(actor.id(), attempt, new Attempt(attempt.started(), false));
        }
    }

    private BookKinUser authorize(AiBookClassificationService.Source source, Principal principal) {
        BookKinUser actor = permissions.actor(principal);
        if (source == AiBookClassificationService.Source.BOOK) {
            permissions.require(principal, "reader.read");
            permissions.require(principal, "library.edit");
        } else {
            if (actor.role() != UserRole.OWNER && actor.role() != UserRole.ADMIN) {
                throw ApiException.forbidden("OWNER_OR_ADMIN_REQUIRED", "只有主人或管理员可以分析上传草稿。");
            }
            permissions.require(principal, "library.upload");
        }
        return actor;
    }

    private Attempt acquire(UUID actorId) {
        long now = System.currentTimeMillis();
        attempts.entrySet().removeIf(entry -> !entry.getValue().running() && now - entry.getValue().started() > 60_000);
        Attempt attempt = new Attempt(now, true);
        Attempt accepted = attempts.compute(actorId, (id, previous) -> previous != null
                && (previous.running() || now - previous.started() < 3_000) ? previous : attempt);
        if (accepted != attempt) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "AI_BUSY", "请等待当前 AI 请求完成，稍后再试。");
        return attempt;
    }

    private SourceText load(AiBookClassificationService.Source source, UUID id, Principal principal) throws Exception {
        try {
            if (source == AiBookClassificationService.Source.BOOK) {
                if (!books.exists(id)) throw ApiException.notFound("BOOK_NOT_FOUND", "书籍不存在。");
                BookFile before = currentBookFile(id);
                BookTextSampler.Sample sample = text.sample(before);
                BookFile after = currentBookFile(id);
                if (!sameBookFile(before, after)) {
                    throw ApiException.conflict("AI_SOURCE_CHANGED", "正文已更新，请重新分析知识点。");
                }
                return new SourceText(sample, before.fingerprint(),
                        "BOOK:" + before.id() + ":" + before.fingerprint() + ":" + before.status());
            }

            BookUpload before = readyUpload(id, principal);
            BookTextSampler.Sample sample = uploads.sampleText(id, principal);
            BookUpload after = readyUpload(id, principal);
            if (!sameUploadVersion(before, after)) {
                throw ApiException.conflict("AI_SOURCE_CHANGED", "上传文件已变化，请重新分析知识点。");
            }
            return new SourceText(sample, after.fingerprint(), uploadVersion(after));
        } catch (ApiException exception) {
            throw exception;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw exception;
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "AI_SOURCE_UNREADABLE",
                    "当前文件无法读取正文（可能是加密文件或扫描件）；暂不支持 OCR。");
        }
    }

    private BookFile currentBookFile(UUID id) {
        return books.findPreferredFile(id)
                .filter(candidate -> candidate.bookId().equals(id) && candidate.status() == BookFileStatus.AVAILABLE)
                .orElseThrow(() -> ApiException.notFound("BOOK_FILE_NOT_FOUND", "没有可读取的普通书籍文件。"));
    }

    private boolean sameBookFile(BookFile left, BookFile right) {
        return left.id().equals(right.id()) && left.status() == right.status()
                && left.fingerprint().equals(right.fingerprint());
    }

    private BookUpload readyUpload(UUID id, Principal principal) {
        BookUpload upload = uploads.get(id, principal);
        if (upload.status() != BookUploadStatus.READY_FOR_REVIEW) {
            throw ApiException.conflict("UPLOAD_STATE", "上传草稿已变化或不再可分析，请重新打开草稿。");
        }
        return upload;
    }

    private boolean sameUploadVersion(BookUpload left, BookUpload right) {
        return left.status() == right.status() && left.status() == BookUploadStatus.READY_FOR_REVIEW
                && java.util.Objects.equals(left.fingerprint(), right.fingerprint())
                && java.util.Objects.equals(left.expiresAt(), right.expiresAt());
    }

    private String uploadVersion(BookUpload upload) {
        return "UPLOAD:" + upload.fingerprint() + ":" + upload.status() + ":" + upload.expiresAt();
    }
}
