package com.elexvx.bookkin.ingestion.upload;

import static com.elexvx.bookkin.ingestion.upload.BookUploadModels.*;

import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.config.BookKinProperties;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.io.InputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
// 查询在线候选并补空缺字段；来源失败被隔离，人工值不因自动补全而强制替换。
// Queries online candidates and fills missing fields; provider failures are isolated and manual values are not forcibly replaced.
public class MetadataEnrichmentService {
    private static final Set<String> COVER_HOSTS = Set.of("covers.openlibrary.org", "books.google.com", "books.googleusercontent.com");
    private static final Pattern OPEN_LIBRARY_WORK = Pattern.compile("/works/(OL[0-9]+W)");
    private static final Pattern OPEN_LIBRARY_EDITION = Pattern.compile("/books/(OL[0-9]+M)");
    private static final int OPEN_LIBRARY_WORK_LIMIT = 3;
    private static final int OPEN_LIBRARY_EDITION_LIMIT = 5;
    private static final int MATCH_CANDIDATE_LIMIT = 15;
    private static final int SOURCE_CANDIDATE_PRIORITY_LIMIT = 12;
    private static final int AI_CANDIDATE_PRIORITY_LIMIT = 3;
    private static final int MAX_METADATA_RESPONSE_BYTES = 2 * 1024 * 1024;
    private static final Set<String> METADATA_API_HOSTS = Set.of("openlibrary.org", "www.googleapis.com");
    private final BookUploadRepository uploads;
    private final BookKinProperties properties;
    private final AiMetadataService ai;
    private final ObjectMapper json;
    private final MetadataProviderSettingsService providerSettings;
    private final WikidataMetadataProvider wikidata;
    private final HttpClient http;
    private final JsonTransport transport;
    private final long requestIntervalNanos;
    private long lastRequestAtNanos;

    public MetadataEnrichmentService(BookUploadRepository uploads, BookKinProperties properties, AiMetadataService ai, ObjectMapper json) {
        this(uploads, properties, ai, json, null, null);
    }

    @Autowired
    public MetadataEnrichmentService(BookUploadRepository uploads, BookKinProperties properties, AiMetadataService ai,
                                     ObjectMapper json, MetadataProviderSettingsService providerSettings,
                                     WikidataMetadataProvider wikidata) {
        this(uploads, properties, ai, json, providerSettings, wikidata,
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build(),
                Duration.ofSeconds(1), null);
    }

    MetadataEnrichmentService(BookUploadRepository uploads, BookKinProperties properties, AiMetadataService ai,
                              ObjectMapper json, MetadataProviderSettingsService providerSettings,
                              WikidataMetadataProvider wikidata, HttpClient http, Duration requestInterval,
                              JsonTransport transport) {
        this.uploads = uploads;
        this.properties = properties;
        this.ai = ai;
        this.json = json;
        this.providerSettings = providerSettings;
        this.wikidata = wikidata;
        this.http = http == null
                ? HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build()
                : http;
        this.requestIntervalNanos = requestInterval == null ? Duration.ofSeconds(1).toNanos() : Math.max(0, requestInterval.toNanos());
        this.transport = transport == null ? this::httpGetJson : transport;
    }

    public EnrichmentResult enrich(MetadataDraft local) {
        return enrich(local, false, null, false);
    }

    public EnrichmentResult enrich(MetadataDraft local, boolean includeAi, String providerId, boolean forceAi) {
        List<MetadataCandidate> candidates = new ArrayList<>();
        List<String> ignoredErrors = new ArrayList<>();
        if (enabled(MetadataSource.OPEN_LIBRARY, ignoredErrors)) candidates.addAll(safely("OPEN_LIBRARY", () -> openLibrary(local, false)));
        if (enabled(MetadataSource.GOOGLE_BOOKS, ignoredErrors) && properties != null
                && properties.metadataProviders().googleApiKey() != null && !properties.metadataProviders().googleApiKey().isBlank()) {
            candidates.addAll(safely("GOOGLE_BOOKS", () -> google(local, false)));
        }
        if (enabled(MetadataSource.WIKIDATA, ignoredErrors) && wikidata != null) {
            try { candidates.addAll(wikidata.searchWithErrors(local, false).candidates()); }
            catch (Exception ignored) { /* Provider failure does not block ordinary local correction. */ }
        }
        MetadataDraft enriched = fillBlanks(local, candidates);
        if (includeAi && (forceAi || needsAiHelp(enriched, candidates))) {
            var result = ai.match(enriched, candidates, providerId);
            candidates.addAll(result.candidates());
            enriched = fillBlanks(enriched, result.candidates());
        }
        return new EnrichmentResult(enriched, List.copyOf(candidates));
    }

    /** Collect edition-level candidates without changing any user-authored draft field. */
    public MatchResult match(MetadataDraft draft, String providerId, boolean refresh) {
        List<MetadataCandidate> sourceCandidates = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        if (enabled(MetadataSource.OPEN_LIBRARY, errors)) {
            collect("Open Library", errors, () -> sourceCandidates.addAll(openLibrary(draft, refresh)));
        }
        if (enabled(MetadataSource.GOOGLE_BOOKS, errors) && properties != null
                && properties.metadataProviders().googleApiKey() != null && !properties.metadataProviders().googleApiKey().isBlank()) {
            collect("Google Books", errors, () -> sourceCandidates.addAll(google(draft, refresh)));
        }
        if (enabled(MetadataSource.WIKIDATA, errors) && wikidata != null) {
            collect("Wikidata", errors, () -> {
                WikidataMetadataProvider.SearchResult result = wikidata.searchWithErrors(draft, refresh);
                if (result.candidates() != null) sourceCandidates.addAll(result.candidates());
                if (result.errorDetail() != null && !result.errorDetail().isBlank()) errors.add("Wikidata：" + limitError(result.errorDetail()));
            });
        }

        List<MetadataCandidate> uniqueSources = distinctCandidates(sourceCandidates);
        AiMetadataService.MatchResult aiResult;
        try {
            aiResult = ai == null
                    ? new AiMetadataService.MatchResult(List.of(), List.of(), List.of("AI 匹配服务不可用"))
                    : ai.match(draft, balancedProviderCandidates(uniqueSources, 15), providerId, refresh);
            errors.addAll(aiResult.errors());
        } catch (Exception exception) {
            aiResult = new AiMetadataService.MatchResult(List.of(), List.of(), List.of());
            errors.add("AI 匹配：" + providerError(exception));
        }

        List<MetadataCandidate> uniqueAi = distinctCandidates(aiResult.candidates());
        List<MetadataCandidate> combined = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int prioritySources = Math.min(SOURCE_CANDIDATE_PRIORITY_LIMIT, uniqueSources.size());
        int priorityAi = Math.min(AI_CANDIDATE_PRIORITY_LIMIT, uniqueAi.size());
        for (MetadataCandidate candidate : uniqueSources.subList(0, prioritySources)) addCandidate(combined, seen, candidate);
        for (MetadataCandidate candidate : uniqueAi.subList(0, priorityAi)) addCandidate(combined, seen, candidate);
        for (MetadataCandidate candidate : uniqueSources.subList(prioritySources, uniqueSources.size())) addCandidate(combined, seen, candidate);
        for (MetadataCandidate candidate : uniqueAi.subList(priorityAi, uniqueAi.size())) addCandidate(combined, seen, candidate);
        String errorDetail = errors.isEmpty() ? null : String.join("；", errors.stream().map(this::limitError).toList());
        if (combined.isEmpty() && errorDetail == null) errorDetail = "未找到匹配的版本，请检查书名、作者或 ISBN 后重试。";
        return new MatchResult(List.copyOf(combined), errorDetail);
    }

    public byte[] downloadCover(MetadataCandidate candidate, long maxBytes) throws Exception {
        if (candidate == null || candidate.provider() == MetadataSource.AI || candidate.coverUrl() == null) {
            throw new IllegalArgumentException("候选项没有可下载的权威封面");
        }
        URI uri = URI.create(candidate.coverUrl().replace("http://", "https://"));
        assertCoverHost(uri);
        var request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(8)).header("User-Agent", "BookKin/1.0").GET().build();
        var response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
        assertCoverHost(response.uri());
        if (response.statusCode() != 200 || response.body().length == 0 || response.body().length > maxBytes) {
            throw new IllegalArgumentException("在线封面不可用或超过大小限制");
        }
        String contentType = response.headers().firstValue("content-type").orElse("").toLowerCase(Locale.ROOT);
        if (!contentType.startsWith("image/") || contentType.contains("svg")) throw new IllegalArgumentException("在线封面格式不安全");
        return response.body();
    }

    private List<MetadataCandidate> openLibrary(MetadataDraft draft, boolean refresh) throws Exception {
        String query = draft.isbn() != null && !draft.isbn().isBlank()
                ? "isbn=" + encode(draft.isbn())
                : "title=" + encode(draft.title()) + "&author=" + encode(first(draft.authors()));
        String url = "https://openlibrary.org/search.json?" + query + "&limit=" + OPEN_LIBRARY_WORK_LIMIT + "&fields=key,title,author_name,subject,cover_i";
        return cached("OPEN_LIBRARY", url, refresh, () -> {
            JsonNode root = getJson(url);
            List<MetadataCandidate> values = new ArrayList<>();
            for (JsonNode work : root.path("docs")) {
                if (values.size() >= MATCH_CANDIDATE_LIMIT) break;
                String workKey = text(work, "key");
                Matcher matcher = workKey == null ? null : OPEN_LIBRARY_WORK.matcher(workKey);
                if (matcher == null || !matcher.matches()) continue;
                String workId = matcher.group(1);
                String editionsUrl = "https://openlibrary.org/works/" + workId + "/editions.json?limit=" + OPEN_LIBRARY_EDITION_LIMIT;
                JsonNode editionResponse = getJsonCached("OPEN_LIBRARY", editionsUrl, refresh);
                for (JsonNode edition : editionResponse.path("entries")) {
                    if (values.size() >= MATCH_CANDIDATE_LIMIT) break;
                    String editionKey = text(edition, "key");
                    Matcher editionMatcher = editionKey == null ? null : OPEN_LIBRARY_EDITION.matcher(editionKey);
                    if (editionMatcher == null || !editionMatcher.matches()) continue;
                    String cover = coverUrl(edition.path("covers"), work.path("cover_i"));
                    List<String> isbn13 = strings(edition.path("isbn_13"));
                    String isbn = first(isbn13);
                    if (isbn == null) isbn = first(strings(edition.path("isbn_10")));
                    String sourceUrl = "https://openlibrary.org/books/" + editionMatcher.group(1);
                    values.add(new MetadataCandidate(editionKey, MetadataSource.OPEN_LIBRARY, "Open Library",
                            firstNonBlank(text(edition, "title"), text(work, "title")), text(edition, "subtitle"),
                            strings(work.path("author_name")), first(strings(edition.path("publishers"))),
                            text(edition, "publish_date"), isbn, null,
                            strings(work.path("subject")).stream().limit(20).toList(), cover, null, null, false,
                            text(edition, "edition_name"), language(edition.path("languages")), sourceUrl));
                }
            }
            return distinctCandidates(values).stream().limit(MATCH_CANDIDATE_LIMIT).toList();
        });
    }

    private List<MetadataCandidate> google(MetadataDraft draft, boolean refresh) throws Exception {
        String q = draft.isbn() != null && !draft.isbn().isBlank()
                ? "isbn:" + draft.isbn()
                : "intitle:" + draft.title() + (draft.authors().isEmpty() ? "" : "+inauthor:" + draft.authors().getFirst());
        String url = "https://www.googleapis.com/books/v1/volumes?q=" + encode(q) + "&maxResults=3&key=" + encode(properties.metadataProviders().googleApiKey());
        return cached("GOOGLE_BOOKS", url.replace(properties.metadataProviders().googleApiKey(), "[KEY]"), refresh, () -> {
            JsonNode root = getJson(url);
            List<MetadataCandidate> values = new ArrayList<>();
            for (JsonNode item : root.path("items")) {
                JsonNode node = item.path("volumeInfo");
                String isbn = null;
                for (JsonNode identifier : node.path("industryIdentifiers")) {
                    if (identifier.path("type").asText().startsWith("ISBN")) { isbn = identifier.path("identifier").asText(); break; }
                }
                String cover = text(node.path("imageLinks"), "thumbnail");
                values.add(new MetadataCandidate(text(item, "id"), MetadataSource.GOOGLE_BOOKS, "Google Books", text(node, "title"), text(node, "subtitle"),
                        strings(node.path("authors")), text(node, "publisher"), text(node, "publishedDate"), isbn,
                        text(node, "description"), strings(node.path("categories")), cover, null, null, false,
                        text(node, "edition"), text(node, "language"), safeSourceUrl(text(node, "infoLink"))));
            }
            return values;
        });
    }

    MetadataDraft fillBlanks(MetadataDraft local, List<MetadataCandidate> candidates) {
        String title = local.title();
        String subtitle = local.subtitle();
        List<String> authors = unknownAuthors(local.authors()) ? List.of() : local.authors();
        String publisher = local.publisher();
        String date = local.publishedDate();
        String isbn = local.isbn();
        String description = local.description();
        List<String> tags = local.tags();
        Map<String, MetadataSource> sources = new HashMap<>(local.sources());
        for (MetadataCandidate candidate : candidates) {
            if (sources.get("title") != MetadataSource.MANUAL && blank(title) && !blank(candidate.title())) { title = candidate.title(); sources.put("title", candidate.provider()); }
            if (sources.get("subtitle") != MetadataSource.MANUAL && blank(subtitle) && !blank(candidate.subtitle())) { subtitle = candidate.subtitle(); sources.put("subtitle", candidate.provider()); }
            if (sources.get("authors") != MetadataSource.MANUAL && authors.isEmpty() && candidate.authors() != null && !candidate.authors().isEmpty()) { authors = candidate.authors(); sources.put("authors", candidate.provider()); }
            if (sources.get("publisher") != MetadataSource.MANUAL && blank(publisher) && !blank(candidate.publisher())) { publisher = candidate.publisher(); sources.put("publisher", candidate.provider()); }
            if (sources.get("publishedDate") != MetadataSource.MANUAL && blank(date) && !blank(candidate.publishedDate())) { date = candidate.publishedDate(); sources.put("publishedDate", candidate.provider()); }
            if (sources.get("isbn") != MetadataSource.MANUAL && blank(isbn) && !blank(candidate.isbn())) { isbn = candidate.isbn(); sources.put("isbn", candidate.provider()); }
            if (sources.get("description") != MetadataSource.MANUAL && blank(description) && !blank(candidate.description())) { description = candidate.description(); sources.put("description", candidate.provider()); }
            if (sources.get("tags") != MetadataSource.MANUAL && tags.isEmpty() && candidate.tags() != null && !candidate.tags().isEmpty()) { tags = candidate.tags(); sources.put("tags", candidate.provider()); }
        }
        return new MetadataDraft(title, subtitle, authors.isEmpty() ? local.authors() : authors, local.translators(), local.language(), publisher, date, isbn,
                description, local.series(), local.seriesIndex(), tags, local.pageCount(), local.wordCount(), sources, local.targetPath(), local.publiclyVisible(),
                local.subjectCodes(), local.authorBiography(), local.tableOfContents(), local.knowledgeDraft(), local.knowledgeTerms());
    }

    private boolean needsAiHelp(MetadataDraft local, List<MetadataCandidate> candidates) {
        if (candidates.isEmpty()) return true;
        String isbn = normalize(local.isbn());
        String title = normalize(local.title());
        String authors = normalize(String.join(" ", meaningfulAuthors(local.authors())));
        return candidates.stream().noneMatch(candidate -> {
            String candidateIsbn = normalize(candidate.isbn());
            if (!isbn.isBlank() && !candidateIsbn.isBlank()) return isbn.equals(candidateIsbn);
            String candidateTitle = normalize(candidate.title());
            String candidateAuthors = normalize(String.join(" ", candidate.authors() == null ? List.of() : candidate.authors()));
            return !title.isBlank() && title.equals(candidateTitle) && (authors.isBlank() || candidateAuthors.contains(authors) || authors.contains(candidateAuthors));
        });
    }

    private List<MetadataCandidate> cached(String provider, String cacheInput, boolean refresh, CandidateSupplier supplier) throws Exception {
        String hash = "sha256:" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(cacheInput.getBytes(StandardCharsets.UTF_8)));
        String cached = refresh || uploads == null ? null : uploads.cached(provider, hash);
        if (cached != null) return json.readValue(cached, new TypeReference<>() {});
        List<MetadataCandidate> value = supplier.get();
        if (uploads != null) uploads.cache(provider, hash, json.writeValueAsString(value), OffsetDateTime.now().plusDays(30));
        return value;
    }

    private JsonNode getJsonCached(String provider, String url, boolean refresh) throws Exception {
        String hash = "sha256:" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(url.getBytes(StandardCharsets.UTF_8)));
        String cached = refresh || uploads == null ? null : uploads.cached(provider, hash);
        if (cached != null) return json.readTree(cached);
        JsonNode value = getJson(url);
        if (uploads != null) uploads.cache(provider, hash, json.writeValueAsString(value), OffsetDateTime.now().plusDays(30));
        return value;
    }

    private List<MetadataCandidate> safely(String provider, CandidateSupplier supplier) {
        try { return supplier.get(); }
        catch (Exception ignored) { return List.of(); }
    }

    private synchronized JsonNode getJson(String url) throws Exception {
        long now = System.nanoTime();
        long waitNanos = requestIntervalNanos - (now - lastRequestAtNanos);
        if (lastRequestAtNanos != 0 && waitNanos > 0) {
            try { Thread.sleep(waitNanos / 1_000_000, (int) (waitNanos % 1_000_000)); }
            catch (InterruptedException exception) { Thread.currentThread().interrupt(); throw exception; }
        }
        lastRequestAtNanos = System.nanoTime();
        URI uri = validateProviderUri(url);
        return transport.get(uri.toASCIIString());
    }

    private JsonNode httpGetJson(String url) throws Exception {
        URI uri = validateProviderUri(url);
        var request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(5)).header("User-Agent", "BookKin/1.0")
                .header("Accept", "application/json").GET().build();
        var response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
        return readJsonResponse(uri, response, json);
    }

    static URI validateProviderUri(String value) {
        URI uri = URI.create(value);
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || !METADATA_API_HOSTS.contains(host)
                || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443) || uri.getFragment() != null) {
            throw new IllegalArgumentException("metadata provider host is not allowed");
        }
        return uri;
    }

    static JsonNode readJsonResponse(URI requestUri, HttpResponse<InputStream> response, ObjectMapper json) throws Exception {
        try (InputStream body = response.body()) {
            int status = response.statusCode();
            if (status != 200) throw new IllegalStateException(status >= 300 && status < 400
                    ? "metadata provider redirect was rejected" : "metadata provider returned " + status);
            URI responseUri = validateProviderUri(response.uri().toASCIIString());
            if (!requestUri.equals(responseUri)) throw new IllegalStateException("metadata provider redirect was rejected");
            long declaredLength = response.headers().firstValueAsLong("content-length").orElse(-1L);
            if (declaredLength > MAX_METADATA_RESPONSE_BYTES) throw new IllegalStateException("metadata provider response exceeds size limit");
            byte[] bytes = readBounded(body);
            return json.readTree(bytes);
        }
    }

    static byte[] readBounded(InputStream input) throws IOException {
        byte[] bytes = input.readNBytes(MAX_METADATA_RESPONSE_BYTES + 1);
        if (bytes.length > MAX_METADATA_RESPONSE_BYTES) throw new IOException("metadata provider response exceeds size limit");
        return bytes;
    }

    private boolean enabled(MetadataSource provider, List<String> errors) {
        if (providerSettings != null) {
            try { return providerSettings.isEnabled(provider); }
            catch (Exception exception) {
                errors.add(provider.name() + "：" + providerError(exception));
                return false;
            }
        }
        return provider == MetadataSource.OPEN_LIBRARY && properties != null && properties.metadataProviders().openLibraryEnabled()
                || provider == MetadataSource.GOOGLE_BOOKS && properties != null && properties.metadataProviders().googleApiKey() != null
                && !properties.metadataProviders().googleApiKey().isBlank();
    }

    private void assertCoverHost(URI uri) {
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || (!COVER_HOSTS.contains(host) && !host.endsWith(".googleusercontent.com"))) {
            throw new IllegalArgumentException("在线封面来源不受信任");
        }
    }

    private String coverUrl(JsonNode editionCovers, JsonNode workCoverId) {
        JsonNode coverId = editionCovers != null && editionCovers.isArray() && editionCovers.size() > 0
                ? editionCovers.get(0) : workCoverId;
        if (coverId == null || coverId.isNull() || !coverId.isNumber()) return null;
        return "https://covers.openlibrary.org/b/id/" + coverId.asText() + "-L.jpg";
    }

    private String language(JsonNode languages) {
        if (languages == null || !languages.isArray() || languages.size() == 0) return null;
        JsonNode value = languages.get(0);
        String key = value.isTextual() ? value.asText() : text(value, "key");
        if (key == null || key.isBlank()) return null;
        int slash = key.lastIndexOf('/');
        return slash >= 0 ? key.substring(slash + 1) : key;
    }

    private String firstNonBlank(String first, String fallback) { return blank(first) ? fallback : first; }

    private String safeSourceUrl(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            URI uri = URI.create(value.strip());
            String scheme = uri.getScheme();
            if ((!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme))
                    || uri.getHost() == null || uri.getHost().isBlank() || uri.getUserInfo() != null) return null;
            return uri.normalize().toASCIIString();
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private List<MetadataCandidate> distinctCandidates(List<MetadataCandidate> candidates) {
        List<MetadataCandidate> values = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        if (candidates == null) return values;
        for (MetadataCandidate candidate : candidates) {
            if (candidate != null && seen.add(candidateKey(candidate))) values.add(candidate);
        }
        return values;
    }

    private List<MetadataCandidate> balancedProviderCandidates(List<MetadataCandidate> candidates, int limit) {
        Map<MetadataSource, List<MetadataCandidate>> groups = new LinkedHashMap<>();
        for (MetadataCandidate candidate : candidates) {
            groups.computeIfAbsent(candidate.provider(), ignored -> new ArrayList<>()).add(candidate);
        }
        Map<MetadataSource, Integer> positions = new HashMap<>();
        List<MetadataCandidate> balanced = new ArrayList<>();
        while (balanced.size() < limit) {
            boolean added = false;
            for (Map.Entry<MetadataSource, List<MetadataCandidate>> entry : groups.entrySet()) {
                int position = positions.getOrDefault(entry.getKey(), 0);
                if (position >= entry.getValue().size()) continue;
                balanced.add(entry.getValue().get(position));
                positions.put(entry.getKey(), position + 1);
                added = true;
                if (balanced.size() >= limit) break;
            }
            if (!added) break;
        }
        return List.copyOf(balanced);
    }

    private void addCandidate(List<MetadataCandidate> values, Set<String> seen, MetadataCandidate candidate) {
        if (candidate == null || values.size() >= MATCH_CANDIDATE_LIMIT) return;
        String key = candidateKey(candidate);
        if (seen.add(key)) values.add(candidate);
    }

    private String candidateKey(MetadataCandidate candidate) {
        String provider = candidate.provider() == null ? "UNKNOWN" : candidate.provider().name();
        if (!blank(candidate.id())) return provider + "|id|" + candidate.id();
        if (!blank(candidate.isbn()) || !blank(candidate.publisher()) || !blank(candidate.publishedDate()) || !blank(candidate.edition())) {
            return provider + "|edition|" + normalize(candidate.isbn()) + "|" + normalize(candidate.publisher()) + "|"
                    + normalize(candidate.publishedDate()) + "|" + normalize(candidate.edition());
        }
        return provider + "|title|" + normalize(candidate.title()) + "|" + normalize(String.join("|", candidate.authors() == null ? List.of() : candidate.authors()));
    }

    private void collect(String provider, List<String> errors, CandidateCollector collector) {
        try { collector.collect(); }
        catch (Exception exception) { errors.add(provider + "：" + providerError(exception)); }
    }

    private String providerError(Exception exception) {
        if (exception instanceof java.net.http.HttpTimeoutException) return "请求超时，可稍后重试";
        if (exception instanceof InterruptedException) return "请求已中断，可稍后重试";
        String message = exception.getMessage();
        if (message == null || message.isBlank()) return "暂时不可用，可稍后重试";
        return limitError(message);
    }

    private String limitError(String value) {
        if (value == null || value.isBlank()) return "暂时不可用，可稍后重试";
        String clean = value.replaceAll("[\\p{Cntrl}]", " ").strip();
        return clean.substring(0, Math.min(200, clean.length()));
    }

    private String text(JsonNode node, String field) { return node.hasNonNull(field) && !node.get(field).asText().isBlank() ? node.get(field).asText() : null; }
    private String integerText(JsonNode node, String field) { return node.has(field) && node.get(field).isNumber() ? node.get(field).asText() : null; }
    private List<String> strings(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<String> values = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (JsonNode item : node) if (item.isTextual() && seen.add(item.asText())) values.add(item.asText());
        return values;
    }
    private String first(List<String> values) { return values == null || values.isEmpty() ? null : values.getFirst(); }
    private boolean blank(String value) { return value == null || value.isBlank(); }
    private String normalize(String value) { return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[\\p{Punct}\\s]+", ""); }
    private List<String> meaningfulAuthors(List<String> values) {
        return values == null ? List.of() : values.stream().filter(value -> value != null && !value.isBlank() && !"未知作者".equals(value.strip())).toList();
    }
    private boolean unknownAuthors(List<String> values) { return meaningfulAuthors(values).isEmpty(); }
    private String encode(String value) { return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8); }

    public record EnrichmentResult(MetadataDraft draft, List<MetadataCandidate> candidates) {}
    public record MatchResult(List<MetadataCandidate> candidates, String errorDetail) {}
    @FunctionalInterface interface JsonTransport { JsonNode get(String url) throws Exception; }
    @FunctionalInterface private interface CandidateSupplier { List<MetadataCandidate> get() throws Exception; }
    @FunctionalInterface private interface CandidateCollector { void collect() throws Exception; }
}
