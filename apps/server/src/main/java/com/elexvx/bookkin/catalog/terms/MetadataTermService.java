package com.elexvx.bookkin.catalog.terms;

import com.elexvx.bookkin.ai.AiMetadataService.KnowledgePoint;
import com.elexvx.bookkin.auth.RolePermissionService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.catalog.BookMetadataRepository;
import java.security.Principal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Searchable catalog vocabulary shared by metadata editors and upload reviews. */
@Service
public class MetadataTermService {
    public record TermInput(String value, String label) {}
    private record RateWindow(long startedAt, int count) {}

    private static final int MAX_RESULTS = 30;
    private static final int MAX_BATCH = 50;
    private static final int MAX_WRITES_PER_MINUTE = 60;
    private final MetadataTermRepository repository;
    private final RolePermissionService permissions;
    private final ConcurrentHashMap<UUID, RateWindow> writes = new ConcurrentHashMap<>();

    public MetadataTermService(MetadataTermRepository repository, RolePermissionService permissions) {
        this.repository = repository;
        this.permissions = permissions;
    }

    public List<MetadataTerm> search(MetadataTermKind kind, String query, int limit, Principal principal) {
        requireManager(principal);
        if (kind == null || limit < 1 || limit > MAX_RESULTS || query == null || query.length() > 200
                || query.codePoints().anyMatch(Character::isISOControl)) {
            throw ApiException.badRequest("INVALID_METADATA_TERM_QUERY", "词库查询条件无效。");
        }
        return repository.search(kind, query.strip(), limit);
    }

    @Transactional
    public MetadataTerm create(MetadataTermKind kind, TermInput input, Principal principal) {
        requireManager(principal);
        UUID actorId = actorId(principal);
        rateLimit(actorId);
        if (input == null) throw ApiException.badRequest("INVALID_METADATA_TERM", "词条内容无效。");
        return createTerm(kind, input);
    }

    /** Creates or reuses terms in input order under one database transaction. */
    @Transactional
    public List<MetadataTerm> ensure(MetadataTermKind kind, List<TermInput> inputs, Principal principal) {
        requireManager(principal);
        UUID actorId = actorId(principal);
        rateLimit(actorId);
        if (inputs == null || inputs.size() > MAX_BATCH) {
            throw ApiException.badRequest("INVALID_METADATA_TERM_BATCH", "词条批量数量不能超过 50 项。");
        }
        List<MetadataTerm> result = new ArrayList<>(inputs.size());
        for (TermInput input : inputs) result.add(createTerm(kind, input));
        return List.copyOf(result);
    }

    @Transactional
    public void saveBookKnowledgeTerms(UUID bookId, List<String> values, Principal principal) {
        permissions.require(principal, "library.edit");
        if (values == null) return;
        repository.replaceBookKnowledgeTerms(bookId, knowledgeTerms(values));
    }

    /** Upload commit calls this inside its existing ingestion transaction after it authorized the upload owner. */
    @Transactional
    public void saveUploadedBookKnowledgeTerms(UUID bookId, List<String> values) {
        if (values != null) repository.replaceBookKnowledgeTerms(bookId, knowledgeTerms(values));
    }

    public List<String> validateKnowledgeTermValues(List<String> values) {
        if (values == null) return null;
        if (values.size() > MAX_BATCH) throw ApiException.badRequest("INVALID_METADATA_TERM_BATCH", "知识点数量不能超过 50 项。");
        List<String> result = new ArrayList<>();
        java.util.HashSet<String> seen = new java.util.HashSet<>();
        for (String value : values) {
            String safe = clean(value, MetadataTermKind.KNOWLEDGE);
            if (seen.add(MetadataTermText.normalizedKey(safe))) result.add(safe);
        }
        return List.copyOf(result);
    }

    /** Adds evidence-backed graph names to the shared dictionary without manufacturing evidence or manual links. */
    @Transactional
    public void registerKnowledgePoints(List<KnowledgePoint> points) {
        if (points == null) return;
        for (KnowledgePoint point : points) {
            if (point != null) {
                String value = clean(point.name(), MetadataTermKind.KNOWLEDGE);
                repository.ensure(MetadataTermKind.KNOWLEDGE, value, value);
            }
        }
    }

    /** Ensures each value already written to the legacy comma-separated language field is searchable. */
    @Transactional
    public void ensureLanguages(String serialized) {
        for (String raw : MetadataTermText.splitLanguages(serialized)) {
            MetadataTermText.LanguageValue language;
            try { language = MetadataTermText.language(raw, raw); }
            catch (IllegalArgumentException invalid) { continue; }
            repository.ensure(MetadataTermKind.LANGUAGE, language.value(), language.label());
        }
    }

    /** Returns the existing catalog spelling, inserting a reusable term when this metadata edit introduces it. */
    @Transactional
    public String canonicalSeries(String raw) {
        if (raw == null || raw.isBlank()) return raw;
        String value = clean(raw, MetadataTermKind.SERIES);
        return repository.ensure(MetadataTermKind.SERIES, value, value).value();
    }

    @Transactional
    public List<String> canonicalTags(List<String> raw) {
        if (raw == null) return null;
        if (raw.size() > 50) throw ApiException.badRequest("INVALID_METADATA_TERM_BATCH", "标签数量不能超过 50 项。");
        List<String> result = new ArrayList<>();
        for (String item : raw) {
            if (item == null || item.isBlank()) continue;
            String value = clean(item, MetadataTermKind.TAG);
            String canonical = repository.ensure(MetadataTermKind.TAG, value, value).value();
            if (result.stream().noneMatch(existing -> MetadataTermText.normalizedKey(existing)
                    .equals(MetadataTermText.normalizedKey(canonical)))) result.add(canonical);
        }
        return List.copyOf(result);
    }

    public BookMetadataRepository.MetadataPatch canonicalizeMetadataTerms(BookMetadataRepository.MetadataPatch patch) {
        java.util.Set<String> fields = patch.manualFields() == null ? java.util.Set.of()
                : new java.util.HashSet<>(java.util.Arrays.asList(patch.manualFields()));
        String series = fields.contains("series") ? canonicalSeries(patch.series()) : patch.series();
        List<String> tags = fields.contains("tags") ? canonicalTags(patch.tags()) : patch.tags();
        return new BookMetadataRepository.MetadataPatch(patch.title(), patch.subtitle(), patch.authors(), patch.translators(),
                patch.language(), patch.publisher(), patch.publishedDate(), patch.isbn(), patch.description(), series,
                patch.seriesIndex(), tags, patch.subjectCodes(), patch.manualFields(), patch.authorBiography(), patch.tableOfContents());
    }

    public MetadataTerm previewLanguage(String value, String label) {
        try {
            MetadataTermText.LanguageValue language = MetadataTermText.language(value, label);
            return new MetadataTerm("", MetadataTermKind.LANGUAGE, language.value(), language.label());
        } catch (IllegalArgumentException invalid) {
            throw ApiException.badRequest("INVALID_METADATA_TERM", "语言候选内容无效。");
        }
    }

    public MetadataTerm previewSeries(String value, String label) {
        String safeValue = clean(value == null || value.isBlank() ? label : value, MetadataTermKind.SERIES);
        String safeLabel = clean(label == null || label.isBlank() ? safeValue : label, MetadataTermKind.SERIES);
        // series is backed by series.name, which has one canonical display value.
        return new MetadataTerm("", MetadataTermKind.SERIES, safeValue, safeValue.equals(safeLabel) ? safeLabel : safeValue);
    }

    private MetadataTerm createTerm(MetadataTermKind kind, TermInput input) {
        if (kind == null) throw ApiException.badRequest("INVALID_METADATA_TERM_KIND", "词条类型无效。");
        if (input == null) throw ApiException.badRequest("INVALID_METADATA_TERM", "词条内容无效。");
        try {
            if (kind == MetadataTermKind.LANGUAGE) {
                MetadataTermText.LanguageValue value = MetadataTermText.language(input.value(), input.label());
                return repository.ensure(kind, value.value(), value.label());
            }
            String value = clean(input.label() == null || input.label().isBlank() ? input.value() : input.label(), kind);
            return repository.ensure(kind, value, value);
        } catch (IllegalArgumentException invalid) {
            throw ApiException.badRequest("INVALID_METADATA_TERM", "词条内容无效或超过该类型长度上限。");
        }
    }

    private List<MetadataTerm> knowledgeTerms(List<String> values) {
        List<MetadataTerm> result = new ArrayList<>();
        for (String safe : validateKnowledgeTermValues(values))
            result.add(repository.ensure(MetadataTermKind.KNOWLEDGE, safe, safe));
        return List.copyOf(result);
    }

    private String clean(String raw, MetadataTermKind kind) {
        try { return MetadataTermText.clean(raw, kind); }
        catch (IllegalArgumentException invalid) {
            throw ApiException.badRequest("INVALID_METADATA_TERM", "词条内容无效或超过该类型长度上限。");
        }
    }

    private void requireManager(Principal principal) {
        var grants = permissions.snapshot(principal).grants();
        if (!grants.contains("library.upload") && !grants.contains("library.edit")) {
            throw ApiException.forbidden("PERMISSION_DENIED", "当前角色没有管理共享元数据词库的权限。");
        }
    }

    private UUID actorId(Principal principal) { return permissions.actor(principal).id(); }

    private void rateLimit(UUID actorId) {
        long now = System.currentTimeMillis();
        RateWindow updated = writes.compute(actorId, (id, previous) -> previous == null || now - previous.startedAt() >= 60_000
                ? new RateWindow(now, 1) : new RateWindow(previous.startedAt(), previous.count() + 1));
        writes.entrySet().removeIf(entry -> now - entry.getValue().startedAt() > 120_000);
        if (updated.count() > MAX_WRITES_PER_MINUTE) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "METADATA_TERM_RATE_LIMIT", "词库修改过于频繁，请稍后再试。");
        }
    }
}
