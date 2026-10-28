package com.elexvx.bookkin.ingestion.upload;

import static com.elexvx.bookkin.ingestion.upload.BookUploadModels.MetadataCandidate;
import static com.elexvx.bookkin.ingestion.upload.BookUploadModels.MetadataDraft;
import static com.elexvx.bookkin.ingestion.upload.BookUploadModels.MetadataSource;

import com.elexvx.bookkin.ingestion.upload.BookUploadRepository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.http.HttpTimeoutException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;
import java.util.zip.InflaterInputStream;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Search-only Wikidata adapter. It never fetches or downloads book files or cover images. */
@Component
public class WikidataMetadataProvider {
    private static final URI ACTION_API = URI.create("https://www.wikidata.org/w/api.php");
    private static final URI QUERY_API = URI.create("https://query.wikidata.org/sparql");
    private static final int MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
    private static final int MAX_CANDIDATES = 10;
    private static final int MAX_REFERENCE_ENTITIES = 100;
    private static final Duration ACTION_TIMEOUT = Duration.ofSeconds(6);
    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(8);
    private static final Pattern ITEM_ID = Pattern.compile("(?:^|/)(Q[1-9][0-9]*)$");
    private static final Set<String> BOOK_INSTANCE_TYPES = Set.of(
            "Q3331189", // book edition
            "Q571", // book
            "Q47461344", // written work
            "Q7725634", // literary work
            "Q3305213" // version, edition or translation
    );

    private final BookUploadRepository uploads;
    private final ObjectMapper json;
    private final HttpClient http;

    @Autowired
    public WikidataMetadataProvider(BookUploadRepository uploads, ObjectMapper json) {
        this(uploads, json, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3))
                .followRedirects(HttpClient.Redirect.NEVER).build());
    }

    WikidataMetadataProvider(BookUploadRepository uploads, ObjectMapper json, HttpClient http) {
        this.uploads = uploads;
        this.json = json;
        this.http = http;
    }

    /**
     * Looks up book editions using ISBN characteristics and Wikidata's entity search.
     */
    public List<MetadataCandidate> search(MetadataDraft draft, boolean refresh) {
        return searchWithErrors(draft, refresh).candidates();
    }

    /** Returns partial candidates together with a safe, actionable provider error when a lookup fails. */
    public SearchResult searchWithErrors(MetadataDraft draft, boolean refresh) {
        if (draft == null) return new SearchResult(List.of(), null);
        String isbn = normalizedIsbn(draft.isbn());
        String title = clean(draft.title());
        if (!validIsbn(isbn) && title.isBlank()) return new SearchResult(List.of(), null);
        String cacheHash = cacheHash(draft);
        if (!refresh) {
            List<MetadataCandidate> cached = readCache(cacheHash);
            if (cached != null) return new SearchResult(cached, null);
        }

        LinkedHashSet<String> itemIds = new LinkedHashSet<>();
        FailureKind failure = FailureKind.NONE;
        if (validIsbn(isbn)) {
            try {
                itemIds.addAll(searchIsbn(isbn));
            } catch (ProviderAccessException exception) {
                failure = merge(failure, exception.kind());
            }
        }

        if (failure != FailureKind.RATE_LIMITED && itemIds.isEmpty() && !title.isBlank()) {
            String author = draft.authors() == null ? "" : draft.authors().stream()
                    .filter(value -> value != null && !value.isBlank() && !"未知作者".equals(value.strip()))
                    .findFirst().orElse("").strip();
            String language = containsHan(title) ? "zh" : "en";
            String search = author.isBlank() ? title : title + " " + author;
            try {
                itemIds.addAll(searchEntities(search, language));
                if (itemIds.isEmpty() && !author.isBlank()) itemIds.addAll(searchEntities(title, language));
            } catch (ProviderAccessException exception) {
                failure = merge(failure, exception.kind());
            }
        }

        List<MetadataCandidate> candidates = List.of();
        if (!itemIds.isEmpty() && failure != FailureKind.RATE_LIMITED) {
            try {
                CandidateLoad loaded = loadCandidates(itemIds.stream().limit(MAX_CANDIDATES).toList(), draft);
                candidates = loaded.candidates();
                failure = merge(failure, loaded.failure());
            } catch (ProviderAccessException exception) {
                failure = merge(failure, exception.kind());
                candidates = List.of();
            }
        }
        if (candidates.isEmpty() && failure == FailureKind.NONE && !title.isBlank()) {
            String author = draft.authors() == null ? "" : draft.authors().stream()
                    .filter(value -> value != null && !value.isBlank() && !"未知作者".equals(value.strip()))
                    .findFirst().orElse("").strip();
            if (!author.isBlank()) {
                try {
                    List<String> titleOnlyIds = searchEntities(title, containsHan(title) ? "zh" : "en");
                    if (!titleOnlyIds.isEmpty()) {
                        CandidateLoad loaded = loadCandidates(titleOnlyIds, draft);
                        candidates = loaded.candidates();
                        failure = merge(failure, loaded.failure());
                    }
                } catch (ProviderAccessException exception) {
                    failure = merge(failure, exception.kind());
                    candidates = List.of();
                }
            }
        }
        if (failure == FailureKind.NONE) cache(cacheHash, candidates);
        return new SearchResult(candidates, failureDetail(failure, !candidates.isEmpty()));
    }

    private List<String> searchIsbn(String isbn) throws ProviderAccessException {
        String property = isbn.length() == 13 ? "P212" : "P957";
        String query = "SELECT ?item WHERE { ?item wdt:" + property + " \"" + isbn + "\" . } LIMIT " + MAX_CANDIDATES;
        JsonNode root = getJson(QUERY_API, "query=" + encode(query) + "&format=json", QUERY_TIMEOUT);
        LinkedHashSet<String> ids = new LinkedHashSet<>();
        for (JsonNode row : root.path("results").path("bindings")) {
            String id = itemId(row.path("item").path("value").asText());
            if (id != null) ids.add(id);
        }
        return List.copyOf(ids);
    }

    private List<String> searchEntities(String query, String language) throws ProviderAccessException {
        String params = "action=wbsearchentities&search=" + encode(query) + "&language=" + encode(language)
                + "&uselang=" + encode(language) + "&type=item&limit=" + MAX_CANDIDATES + "&format=json&maxlag=5";
        JsonNode root = getJson(ACTION_API, params, ACTION_TIMEOUT);
        LinkedHashSet<String> ids = new LinkedHashSet<>();
        for (JsonNode item : root.path("search")) {
            String id = itemId(item.path("id").asText());
            if (id != null) ids.add(id);
            if (ids.size() == MAX_CANDIDATES) break;
        }
        return List.copyOf(ids);
    }

    private CandidateLoad loadCandidates(List<String> requestedIds, MetadataDraft draft) throws ProviderAccessException {
        Map<String, JsonNode> entities = getEntities(requestedIds, true);
        LinkedHashSet<String> referenceIds = new LinkedHashSet<>();
        FailureKind failure = FailureKind.NONE;
        for (JsonNode entity : entities.values()) {
            for (String property : List.of("P50", "P123", "P407", "P921")) {
                for (JsonNode value : claimValues(entity, property)) {
                    String id = itemId(value.path("id").asText());
                    if (id != null) referenceIds.add(id);
                    if (referenceIds.size() == MAX_REFERENCE_ENTITIES) break;
                }
                if (referenceIds.size() == MAX_REFERENCE_ENTITIES) break;
            }
            if (referenceIds.size() == MAX_REFERENCE_ENTITIES) break;
        }
        for (int start = 0; start < referenceIds.size(); start += 50) {
            List<String> batch = referenceIds.stream().skip(start).limit(50).toList();
            try {
                entities.putAll(getEntities(batch, false));
            } catch (ProviderAccessException exception) {
                // Primary book records are still usable when a name lookup is temporarily unavailable.
                failure = merge(failure, exception.kind());
                break;
            }
        }

        List<MetadataCandidate> candidates = new ArrayList<>();
        for (String id : requestedIds) {
            JsonNode entity = entities.get(id);
            if (entity == null || !isBookOrEdition(entity)) continue;
            String title = label(entity);
            if (blank(title)) title = monolingualClaim(entity, "P1476");
            if (blank(title)) continue;

            List<String> authors = labels(entity, "P50", entities);
            List<String> tags = labels(entity, "P921", entities).stream().limit(20).toList();
            String publisher = first(labels(entity, "P123", entities));
            String language = first(labels(entity, "P407", entities));
            String isbn = first(nonBlank(claimStrings(entity, "P212")));
            if (blank(isbn)) isbn = first(nonBlank(claimStrings(entity, "P957")));
            String edition = first(nonBlank(claimStrings(entity, "P393")));
            String published = first(nonBlank(claimStrings(entity, "P577")));
            boolean exactIsbn = !normalizedIsbn(draft.isbn()).isBlank()
                    && normalizedIsbn(draft.isbn()).equals(normalizedIsbn(isbn));
            String sourceUrl = "https://www.wikidata.org/wiki/" + id;
            candidates.add(new MetadataCandidate("wikidata:" + id, MetadataSource.WIKIDATA, "Wikidata",
                    title, monolingualClaim(entity, "P1680"), authors, publisher, published, isbn,
                    null, tags, null, exactIsbn ? 0.98 : null,
                    exactIsbn ? "ISBN exact match" : "Wikidata book or edition match", true,
                    edition, language, sourceUrl));
            if (candidates.size() == MAX_CANDIDATES) break;
        }
        return new CandidateLoad(List.copyOf(candidates), failure);
    }

    private Map<String, JsonNode> getEntities(List<String> ids, boolean includeClaims) throws ProviderAccessException {
        if (ids.isEmpty()) return Map.of();
        String params = "action=wbgetentities&ids=" + encode(String.join("|", ids))
                + (includeClaims ? "&props=labels%7Cclaims" : "&props=labels")
                + "&languages=zh%7Cen&format=json&maxlag=5";
        JsonNode root = getJson(ACTION_API, params, ACTION_TIMEOUT);
        Map<String, JsonNode> result = new LinkedHashMap<>();
        JsonNode values = root.path("entities");
        values.properties().forEach(entry -> result.put(entry.getKey(), entry.getValue()));
            return result;
    }

    private JsonNode getJson(URI base, String params, Duration timeout) throws ProviderAccessException {
        URI uri = URI.create(base.toASCIIString() + "?" + params);
        String expectedHost = base.getHost();
        if (!"https".equalsIgnoreCase(uri.getScheme()) || !expectedHost.equalsIgnoreCase(uri.getHost())) {
            throw new ProviderAccessException(FailureKind.UNAVAILABLE);
        }
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(timeout)
                .header("User-Agent", "BookKin/1.0 (metadata candidate lookup)")
                .header("Accept", "application/json")
                .header("Accept-Encoding", "gzip, deflate")
                .GET().build();
        try {
            HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream body = response.body()) {
                if (response.statusCode() == 429) throw new ProviderAccessException(FailureKind.RATE_LIMITED);
                if (response.statusCode() != 200 || response.uri() == null
                        || !expectedHost.equalsIgnoreCase(response.uri().getHost())) {
                    throw new ProviderAccessException(FailureKind.UNAVAILABLE);
                }
                byte[] bytes = body.readNBytes(MAX_RESPONSE_BYTES + 1);
                if (bytes.length > MAX_RESPONSE_BYTES) throw new ProviderAccessException(FailureKind.UNAVAILABLE);
                String encoding = response.headers().firstValue("content-encoding").orElse("").toLowerCase(Locale.ROOT);
                try (InputStream decoded = switch (encoding) {
                    case "gzip" -> new GZIPInputStream(new ByteArrayInputStream(bytes));
                    case "deflate" -> new InflaterInputStream(new ByteArrayInputStream(bytes));
                    case "" -> new ByteArrayInputStream(bytes);
                    default -> throw new ProviderAccessException(FailureKind.UNAVAILABLE);
                }) {
                    byte[] decodedBytes = decoded.readNBytes(MAX_RESPONSE_BYTES + 1);
                    if (decodedBytes.length > MAX_RESPONSE_BYTES) throw new ProviderAccessException(FailureKind.UNAVAILABLE);
                    JsonNode parsed = json.readTree(new String(decodedBytes, StandardCharsets.UTF_8));
                    JsonNode error = parsed.path("error");
                    if (!error.isMissingNode() && !error.isNull()) {
                        String code = error.path("code").asText("");
                        throw new ProviderAccessException("ratelimited".equalsIgnoreCase(code)
                                ? FailureKind.RATE_LIMITED : FailureKind.UNAVAILABLE);
                    }
                    return parsed;
                }
            }
        } catch (ProviderAccessException exception) {
            throw exception;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ProviderAccessException(FailureKind.INTERRUPTED);
        } catch (HttpTimeoutException exception) {
            throw new ProviderAccessException(FailureKind.TIMEOUT);
        } catch (Exception exception) {
            throw new ProviderAccessException(FailureKind.UNAVAILABLE);
        }
    }

    private List<String> labels(JsonNode entity, String property, Map<String, JsonNode> entities) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (JsonNode value : claimValues(entity, property)) {
            String id = itemId(value.path("id").asText());
            JsonNode referenced = id == null ? null : entities.get(id);
            String name = referenced == null ? null : label(referenced);
            if (!blank(name)) result.add(name);
        }
        return List.copyOf(result);
    }

    private boolean isBookOrEdition(JsonNode entity) {
        if (!claimValues(entity, "P629").isEmpty() || !claimValues(entity, "P212").isEmpty()
                || !claimValues(entity, "P957").isEmpty()) return true;
        for (JsonNode instance : claimValues(entity, "P31")) {
            String id = itemId(instance.path("id").asText());
            if (BOOK_INSTANCE_TYPES.contains(id)) return true;
        }
        return false;
    }

    private List<JsonNode> claimValues(JsonNode entity, String property) {
        List<JsonNode> values = new ArrayList<>();
        JsonNode statements = entity.path("claims").path(property);
        if (!statements.isArray()) return values;
        for (JsonNode statement : statements) {
            if ("deprecated".equals(statement.path("rank").asText())) continue;
            JsonNode snak = statement.path("mainsnak");
            if (!"value".equals(snak.path("snaktype").asText())) continue;
            JsonNode value = snak.path("datavalue").path("value");
            if (!value.isMissingNode() && !value.isNull()) values.add(value);
        }
        return values;
    }

    private List<String> claimStrings(JsonNode entity, String property) {
        List<String> values = new ArrayList<>();
        for (JsonNode value : claimValues(entity, property)) {
            String text = valueText(value);
            if (!blank(text)) values.add(text);
        }
        return values;
    }

    private String monolingualClaim(JsonNode entity, String property) {
        for (JsonNode value : claimValues(entity, property)) {
            String text = value.path("text").asText(null);
            if (!blank(text)) return text.strip();
        }
        return null;
    }

    private String valueText(JsonNode value) {
        if (value.isTextual() || value.isNumber()) return value.asText().strip();
        if (value.hasNonNull("text")) return value.path("text").asText().strip();
        if (value.hasNonNull("amount")) return value.path("amount").asText().replaceFirst("^\\+", "").strip();
        if (value.hasNonNull("time")) return dateText(value.path("time").asText(), value.path("precision").asInt(11));
        return null;
    }

    private String dateText(String value, int precision) {
        Matcher matcher = Pattern.compile("^[+-]?(\\d{4})-(\\d{2})-(\\d{2})").matcher(value);
        if (!matcher.find()) return value;
        if (precision <= 9 || "00".equals(matcher.group(2))) return matcher.group(1);
        if (precision == 10 || "00".equals(matcher.group(3))) return matcher.group(1) + "-" + matcher.group(2);
        return matcher.group(1) + "-" + matcher.group(2) + "-" + matcher.group(3);
    }

    private String label(JsonNode entity) {
        JsonNode labels = entity.path("labels");
        for (String language : List.of("zh", "zh-cn", "zh-hans", "en")) {
            String value = labels.path(language).path("value").asText(null);
            if (!blank(value)) return value.strip();
        }
        return null;
    }

    private String itemId(String value) {
        if (value == null || value.isBlank()) return null;
        Matcher matcher = ITEM_ID.matcher(value.strip());
        return matcher.find() ? matcher.group(1) : null;
    }

    private String first(List<String> values) { return values == null || values.isEmpty() ? null : values.getFirst(); }
    private List<String> nonBlank(List<String> values) { return values.stream().filter(value -> !blank(value)).toList(); }
    private boolean blank(String value) { return value == null || value.isBlank(); }
    private String clean(String value) { return value == null ? "" : value.strip(); }
    private String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private boolean containsHan(String value) {
        return value.codePoints().anyMatch(codePoint -> Character.UnicodeScript.of(codePoint) == Character.UnicodeScript.HAN);
    }

    private boolean validIsbn(String isbn) { return isbn.length() == 10 || isbn.length() == 13; }
    private String normalizedIsbn(String isbn) {
        return isbn == null ? "" : isbn.toUpperCase(Locale.ROOT).replaceAll("[^0-9X]", "");
    }

    private String cacheHash(MetadataDraft draft) {
        String value = "wikidata-match-v2\nISBN=" + normalizedIsbn(draft.isbn()) + "\nTITLE=" + clean(draft.title()).toLowerCase(Locale.ROOT)
                + "\nAUTHORS=" + (draft.authors() == null ? "" : String.join("|", draft.authors()));
        try {
            return "sha256:" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            return "";
        }
    }

    private List<MetadataCandidate> readCache(String hash) {
        try {
            String cached = uploads.cached("WIKIDATA", hash);
            return cached == null ? null : json.readValue(cached, new TypeReference<>() {});
        } catch (Exception exception) {
            return null;
        }
    }

    private void cache(String hash, List<MetadataCandidate> candidates) {
        try {
            uploads.cache("WIKIDATA", hash, json.writeValueAsString(candidates), OffsetDateTime.now().plusDays(30));
        } catch (Exception ignored) {
            // Cache persistence is an optimization and must not block manual review.
        }
    }

    private FailureKind merge(FailureKind current, FailureKind incoming) {
        if (current == FailureKind.RATE_LIMITED || incoming == FailureKind.RATE_LIMITED) return FailureKind.RATE_LIMITED;
        if (current == FailureKind.TIMEOUT || incoming == FailureKind.TIMEOUT) return FailureKind.TIMEOUT;
        if (current == FailureKind.INTERRUPTED || incoming == FailureKind.INTERRUPTED) return FailureKind.INTERRUPTED;
        if (current == FailureKind.UNAVAILABLE || incoming == FailureKind.UNAVAILABLE) return FailureKind.UNAVAILABLE;
        return FailureKind.NONE;
    }

    private String failureDetail(FailureKind failure, boolean hasCandidates) {
        if (failure == FailureKind.NONE) return null;
        String detail = switch (failure) {
            case RATE_LIMITED -> "Wikidata 请求受到限制，请稍后重试。";
            case TIMEOUT -> "Wikidata 查询超时，请检查网络后稍后重试。";
            case INTERRUPTED -> "Wikidata 查询已中断，可稍后重试。";
            case UNAVAILABLE -> "Wikidata 暂时不可用，请检查网络后重试。";
            case NONE -> null;
        };
        return hasCandidates ? detail + " 已找到的候选仍可选择。" : detail;
    }

    public record SearchResult(List<MetadataCandidate> candidates, String errorDetail) {
        public SearchResult {
            candidates = candidates == null ? List.of() : List.copyOf(candidates);
        }
    }

    private record CandidateLoad(List<MetadataCandidate> candidates, FailureKind failure) {}

    private enum FailureKind { NONE, RATE_LIMITED, TIMEOUT, INTERRUPTED, UNAVAILABLE }

    private static final class ProviderAccessException extends Exception {
        private final FailureKind kind;
        private ProviderAccessException(FailureKind kind) { this.kind = kind; }
        private FailureKind kind() { return kind; }
    }
}
