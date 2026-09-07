package io.github.johntao2004.bookkin.ai;

import static io.github.johntao2004.bookkin.ingestion.upload.BookUploadModels.MetadataCandidate;
import static io.github.johntao2004.bookkin.ingestion.upload.BookUploadModels.MetadataDraft;
import static io.github.johntao2004.bookkin.ingestion.upload.BookUploadModels.MetadataSource;

import io.github.johntao2004.bookkin.config.BookKinProperties;
import io.github.johntao2004.bookkin.config.BookKinProperties.AiProvider;
import io.github.johntao2004.bookkin.config.BookKinProperties.AiProviderType;
import io.github.johntao2004.bookkin.ingestion.upload.BookUploadRepository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Server-side AI adapter for bibliographic suggestions.
 *
 * The model only receives extracted metadata and a small provider-candidate summary;
 * it never receives the staged EPUB/PDF bytes. All AI results remain review-required
 * candidates until an owner or administrator explicitly applies them.
 */
@Service
public class AiMetadataService {
    private static final Logger log = LoggerFactory.getLogger(AiMetadataService.class);
    private static final String SYSTEM_PROMPT = """
            你是电子书书目匹配助手。你的任务是根据文件中已提取的书名、作者、ISBN等信息，提出可核对的书目候选。
            只返回 JSON，不要 Markdown，不要解释 JSON 以外的内容。
            不要凭空编造 ISBN、出版社、出版日期或简介；不确定的字段必须为 null 或空数组。
            每个候选都必须标记 0 到 1 的 confidence，并用一句话说明 reason。
            AI 候选不是权威来源，永远需要人工复核；不要输出 coverUrl。
            JSON 结构必须是：
            {"candidates":[{"title":"...","subtitle":null,"authors":["..."],"publisher":null,"publishedDate":null,"isbn":null,"description":null,"tags":[],"confidence":0.0,"reason":"..."}]}
            """;

    private final Supplier<BookKinProperties.Ai> configuration;
    private final BookUploadRepository uploads;
    private final ObjectMapper json;
    private final HttpClient http;

    @org.springframework.beans.factory.annotation.Autowired
    public AiMetadataService(AiSettingsService settings, BookUploadRepository uploads, ObjectMapper json) {
        this(settings::effective, uploads, json, HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build());
    }

    public AiMetadataService(BookKinProperties properties, BookUploadRepository uploads, ObjectMapper json) {
        this(properties::ai, uploads, json, HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build());
    }

    AiMetadataService(BookKinProperties properties, BookUploadRepository uploads, ObjectMapper json, HttpClient http) {
        this(properties::ai, uploads, json, http);
    }

    private AiMetadataService(Supplier<BookKinProperties.Ai> configuration, BookUploadRepository uploads,
                              ObjectMapper json, HttpClient http) {
        this.configuration = configuration;
        this.uploads = uploads;
        this.json = json;
        this.http = http;
    }

    public List<ProviderInfo> providers() {
        BookKinProperties.Ai config = configuration.get();
        return config.providers().stream()
                .filter(provider -> !provider.id().isBlank())
                .map(provider -> new ProviderInfo(provider.id(), provider.label(), provider.type().name(),
                        provider.enabled(), configured(provider), available(provider), provider.model()))
                .toList();
    }

    public boolean hasAvailableProvider(String requestedId) {
        BookKinProperties.Ai config = configuration.get();
        return config.enabled() && config.providers().stream()
                .filter(this::available)
                .anyMatch(provider -> requestedId == null || requestedId.isBlank() || provider.id().equals(requestedId));
    }

    public MatchResult match(MetadataDraft draft, List<MetadataCandidate> existing, String requestedId) {
        BookKinProperties.Ai config = configuration.get();
        if (!config.enabled()) return new MatchResult(List.of(), List.of(), List.of("AI 功能未启用"));
        List<AiProvider> selected = config.providers().stream()
                .filter(this::available)
                .filter(provider -> requestedId == null || requestedId.isBlank() || provider.id().equals(requestedId))
                .toList();
        if (requestedId != null && !requestedId.isBlank() && selected.isEmpty()) {
            return new MatchResult(List.of(), List.of(), List.of("未找到已配置的 AI 平台：" + requestedId));
        }
        if (selected.isEmpty()) return new MatchResult(List.of(), List.of(), List.of("没有已配置且可用的 AI 平台"));

        String prompt;
        try {
            prompt = userPrompt(draft, existing);
        } catch (Exception exception) {
            return new MatchResult(List.of(), List.of(), List.of("AI 请求内容无法生成"));
        }
        List<MetadataCandidate> candidates = new ArrayList<>();
        List<String> attempted = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (AiProvider provider : selected) {
            attempted.add(provider.id());
            try {
                String cacheProvider = cacheProvider(provider);
                String queryHash = sha256(prompt);
                String cached = uploads.cached(cacheProvider, queryHash);
                String response = cached == null ? invoke(provider, prompt) : cached;
                List<MetadataCandidate> values = parseCandidates(response, provider, draft);
                if (cached == null && !values.isEmpty()) {
                    try {
                        uploads.cache(cacheProvider, queryHash, json.writeValueAsString(values), java.time.OffsetDateTime.now().plusDays(7));
                    } catch (Exception cacheException) {
                        log.debug("Unable to cache AI metadata response for {}", provider.id(), cacheException);
                    }
                }
                for (MetadataCandidate candidate : values) {
                    String key = normalize(candidate.title()) + "|" + String.join("|", candidate.authors()).toLowerCase(Locale.ROOT);
                    if (seen.add(key)) candidates.add(candidate);
                }
            } catch (Exception exception) {
                String message = safeMessage(exception);
                errors.add(provider.label() + "：" + message);
                log.warn("AI metadata provider {} failed: {}", provider.id(), message);
            }
            if (candidates.size() >= config.maxCandidates()) break;
        }
        return new MatchResult(candidates.stream().limit(config.maxCandidates()).toList(), List.copyOf(attempted), List.copyOf(errors));
    }

    private String invoke(AiProvider provider, String prompt) throws Exception {
        return switch (provider.type()) {
            case OPENAI_COMPATIBLE -> invokeOpenAiCompatible(provider, prompt);
            case ANTHROPIC -> invokeAnthropic(provider, prompt);
            case GEMINI -> invokeGemini(provider, prompt);
        };
    }

    private String invokeOpenAiCompatible(AiProvider provider, String prompt) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", provider.model());
        body.put("temperature", 0);
        body.put("max_tokens", 1200);
        body.put("messages", List.of(
                Map.of("role", "system", "content", SYSTEM_PROMPT),
                Map.of("role", "user", "content", prompt)));
        HttpRequest.Builder request = request(join(defaultValue(provider.baseUrl(), "https://api.openai.com/v1"), "/chat/completions"), body);
        if (!provider.apiKey().isBlank()) request.header("Authorization", "Bearer " + provider.apiKey());
        JsonNode root = json.readTree(send(request.build()));
        JsonNode content = root.at("/choices/0/message/content");
        if (content.isTextual()) return content.asText();
        if (content.isArray()) {
            for (JsonNode part : content) {
                JsonNode text = part.path("text");
                if (text.isTextual()) return text.asText();
            }
        }
        throw new IllegalStateException("AI 平台没有返回文本结果");
    }

    private String invokeAnthropic(AiProvider provider, String prompt) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", provider.model());
        body.put("max_tokens", 1200);
        body.put("temperature", 0);
        body.put("system", SYSTEM_PROMPT);
        body.put("messages", List.of(Map.of("role", "user", "content", prompt)));
        HttpRequest request = request(join(defaultValue(provider.baseUrl(), "https://api.anthropic.com"), "/v1/messages"), body)
                .header("x-api-key", provider.apiKey())
                .header("anthropic-version", "2023-06-01")
                .build();
        JsonNode root = json.readTree(send(request));
        JsonNode text = root.at("/content/0/text");
        if (!text.isTextual()) throw new IllegalStateException("Anthropic 没有返回文本结果");
        return text.asText();
    }

    private String invokeGemini(AiProvider provider, String prompt) throws Exception {
        String model = provider.model().startsWith("models/") ? provider.model().substring("models/".length()) : provider.model();
        String endpoint = join(defaultValue(provider.baseUrl(), "https://generativelanguage.googleapis.com/v1beta"), "/models/" +
                URLEncoder.encode(model, StandardCharsets.UTF_8) + ":generateContent");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", SYSTEM_PROMPT))));
        body.put("contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", prompt)))));
        body.put("generationConfig", Map.of("temperature", 0, "maxOutputTokens", 1200, "responseMimeType", "application/json"));
        HttpRequest request = request(endpoint, body).header("x-goog-api-key", provider.apiKey()).build();
        JsonNode root = json.readTree(send(request));
        JsonNode text = root.at("/candidates/0/content/parts/0/text");
        if (!text.isTextual()) throw new IllegalStateException("Gemini 没有返回文本结果");
        return text.asText();
    }

    private HttpRequest.Builder request(String endpoint, Map<String, Object> body) throws Exception {
        return HttpRequest.newBuilder(URI.create(endpoint))
                .timeout(configuration.get().timeout())
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body), StandardCharsets.UTF_8));
    }

    private String send(HttpRequest request) throws Exception {
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("AI 平台请求失败（HTTP " + response.statusCode() + "）");
        }
        return response.body();
    }

    private List<MetadataCandidate> parseCandidates(String raw, AiProvider provider, MetadataDraft draft) throws Exception {
        String value = extractJson(raw);
        JsonNode root = json.readTree(value);
        JsonNode values = root.isArray() ? root : root.path("candidates");
        if (!values.isArray() && root.isObject() && root.has("title")) values = json.readTree("[" + value + "]");
        if (!values.isArray()) return List.of();
        List<MetadataCandidate> candidates = new ArrayList<>();
        for (JsonNode node : values) {
            String title = limit(text(node, "title"), 500);
            if (title == null) continue;
            List<String> authors = strings(node.path("authors"), 20, 300);
            if (authors.isEmpty()) authors = meaningfulAuthors(draft.authors());
            Double confidence = number(node, "confidence");
            String fingerprint = sha256(provider.id() + "|" + node.toString());
            candidates.add(new MetadataCandidate("ai:" + provider.id() + ":" + fingerprint.substring(0, 20), MetadataSource.AI,
                    provider.label(), title, limit(text(node, "subtitle"), 500), authors,
                    limit(text(node, "publisher"), 500), limit(text(node, "publishedDate"), 40), limit(text(node, "isbn"), 40),
                    limit(text(node, "description"), 20_000), strings(node.path("tags"), 20, 200), null,
                    confidence == null ? 0.0 : Math.max(0, Math.min(1, confidence)), limit(text(node, "reason"), 500), true));
        }
        return candidates;
    }

    private String userPrompt(MetadataDraft draft, List<MetadataCandidate> existing) {
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("title", draft.title());
        input.put("subtitle", draft.subtitle());
        input.put("authors", draft.authors());
        input.put("translators", draft.translators());
        input.put("language", draft.language());
        input.put("publisher", draft.publisher());
        input.put("publishedDate", draft.publishedDate());
        input.put("isbn", draft.isbn());
        input.put("series", draft.series());
        input.put("tags", draft.tags());
        input.put("existingCandidates", existing == null ? List.of() : existing.stream().limit(5).map(candidate -> Map.of(
                "provider", candidate.provider().name(), "title", candidate.title() == null ? "" : candidate.title(),
                "authors", candidate.authors() == null ? List.of() : candidate.authors(),
                "isbn", candidate.isbn() == null ? "" : candidate.isbn())).toList());
        try {
            return "请根据以下已提取信息，查找或归一化可能的书目候选。无法确认的字段不要猜测。\nINPUT=" + json.writeValueAsString(input);
        } catch (Exception exception) {
            throw new IllegalStateException("AI 请求内容无法序列化", exception);
        }
    }

    private boolean configured(AiProvider provider) {
        if (provider.id().isBlank() || provider.model().isBlank()) return false;
        return switch (provider.type()) {
            case OPENAI_COMPATIBLE -> !provider.apiKey().isBlank() || isLocal(provider.baseUrl());
            case ANTHROPIC, GEMINI -> !provider.apiKey().isBlank();
        };
    }

    private boolean available(AiProvider provider) {
        return configuration.get().enabled() && provider.enabled() && configured(provider);
    }

    private boolean isLocal(String baseUrl) {
        return baseUrl != null && (baseUrl.contains("localhost") || baseUrl.contains("127.0.0.1") || baseUrl.contains("::1"));
    }

    private String cacheProvider(AiProvider provider) {
        return "AI_" + sha256(provider.id()).substring(0, 29);
    }

    private String extractJson(String raw) {
        String value = raw == null ? "" : raw.strip();
        if (value.startsWith("```") && value.endsWith("```")) {
            int newline = value.indexOf('\n');
            value = newline >= 0 ? value.substring(newline + 1, value.length() - 3).strip() : value.substring(3, value.length() - 3).strip();
        }
        int objectStart = value.indexOf('{');
        int arrayStart = value.indexOf('[');
        int start = objectStart < 0 ? arrayStart : arrayStart < 0 ? objectStart : Math.min(objectStart, arrayStart);
        int end = Math.max(value.lastIndexOf('}'), value.lastIndexOf(']'));
        if (start < 0 || end < start) throw new IllegalStateException("AI 返回内容不是有效 JSON");
        return value.substring(start, end + 1);
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isTextual() && !value.asText().isBlank() ? value.asText().strip() : null;
    }

    private Double number(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.asDouble() : null;
    }

    private List<String> strings(JsonNode node, int maxItems, int maxLength) {
        if (node == null || !node.isArray()) return List.of();
        List<String> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (JsonNode value : node) {
            if (!value.isTextual()) continue;
            String clean = limit(value.asText().strip(), maxLength);
            if (clean != null && seen.add(clean)) result.add(clean);
            if (result.size() >= maxItems) break;
        }
        return result;
    }

    private List<String> meaningfulAuthors(List<String> values) {
        if (values == null) return List.of();
        return values.stream().filter(value -> value != null && !value.isBlank() && !"未知作者".equals(value.strip())).toList();
    }

    private String limit(String value, int maxLength) {
        if (value == null || value.isBlank()) return null;
        String clean = value.strip();
        return clean.length() <= maxLength ? clean : clean.substring(0, maxLength);
    }

    private String join(String base, String suffix) {
        String value = defaultValue(base, "").replaceAll("/+$", "");
        return value + (suffix.startsWith("/") ? suffix : "/" + suffix);
    }

    private String defaultValue(String value, String fallback) { return value == null || value.isBlank() ? fallback : value; }

    private String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[\\p{Punct}\\s]+", "");
    }

    private String sha256(String value) {
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private String safeMessage(Exception exception) {
        String value = exception.getMessage();
        return value == null || value.isBlank() ? "平台暂时不可用" : value.substring(0, Math.min(240, value.length()));
    }

    public record ProviderInfo(String id, String label, String type, boolean enabled, boolean configured,
                               boolean available, String model) {}

    public record MatchResult(List<MetadataCandidate> candidates, List<String> attemptedProviders, List<String> errors) {}
}
