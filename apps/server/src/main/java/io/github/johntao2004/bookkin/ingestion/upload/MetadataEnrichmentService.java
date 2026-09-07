package io.github.johntao2004.bookkin.ingestion.upload;

import static io.github.johntao2004.bookkin.ingestion.upload.BookUploadModels.*;

import io.github.johntao2004.bookkin.ai.AiMetadataService;
import io.github.johntao2004.bookkin.config.BookKinProperties;
import tools.jackson.core.type.TypeReference;
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
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class MetadataEnrichmentService {
    private static final Set<String> COVER_HOSTS = Set.of("covers.openlibrary.org", "books.google.com", "books.googleusercontent.com");
    private final BookUploadRepository uploads;
    private final BookKinProperties properties;
    private final AiMetadataService ai;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NORMAL).build();

    public MetadataEnrichmentService(BookUploadRepository uploads, BookKinProperties properties, AiMetadataService ai, ObjectMapper json) {
        this.uploads = uploads;
        this.properties = properties;
        this.ai = ai;
        this.json = json;
    }

    public EnrichmentResult enrich(MetadataDraft local) {
        return enrich(local, false, null, false);
    }

    public EnrichmentResult enrich(MetadataDraft local, boolean includeAi, String providerId, boolean forceAi) {
        List<MetadataCandidate> candidates = new ArrayList<>();
        if (properties.metadataProviders().openLibraryEnabled()) candidates.addAll(safely("OPEN_LIBRARY", () -> openLibrary(local)));
        if (properties.metadataProviders().googleApiKey() != null && !properties.metadataProviders().googleApiKey().isBlank()) {
            candidates.addAll(safely("GOOGLE_BOOKS", () -> google(local)));
        }
        MetadataDraft enriched = fillBlanks(local, candidates);
        if (includeAi && (forceAi || needsAiHelp(enriched, candidates))) {
            var result = ai.match(enriched, candidates, providerId);
            candidates.addAll(result.candidates());
            enriched = fillBlanks(enriched, result.candidates());
        }
        return new EnrichmentResult(enriched, List.copyOf(candidates));
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

    private List<MetadataCandidate> openLibrary(MetadataDraft draft) throws Exception {
        String query = draft.isbn() != null && !draft.isbn().isBlank()
                ? "isbn=" + encode(draft.isbn())
                : "title=" + encode(draft.title()) + "&author=" + encode(first(draft.authors()));
        String url = "https://openlibrary.org/search.json?" + query + "&limit=3&fields=key,title,subtitle,author_name,publisher,first_publish_year,isbn,subject,cover_i";
        return cached("OPEN_LIBRARY", url, () -> {
            JsonNode root = getJson(url);
            List<MetadataCandidate> values = new ArrayList<>();
            for (JsonNode node : root.path("docs")) {
                String id = text(node, "key");
                String cover = node.hasNonNull("cover_i") ? "https://covers.openlibrary.org/b/id/" + node.get("cover_i").asText() + "-L.jpg" : null;
                values.add(new MetadataCandidate(id, MetadataSource.OPEN_LIBRARY, text(node, "title"), text(node, "subtitle"),
                        strings(node.path("author_name")), first(strings(node.path("publisher"))), integerText(node, "first_publish_year"),
                        first(strings(node.path("isbn"))), null, strings(node.path("subject")).stream().limit(20).toList(), cover));
            }
            return values;
        });
    }

    private List<MetadataCandidate> google(MetadataDraft draft) throws Exception {
        String q = draft.isbn() != null && !draft.isbn().isBlank()
                ? "isbn:" + draft.isbn()
                : "intitle:" + draft.title() + (draft.authors().isEmpty() ? "" : "+inauthor:" + draft.authors().getFirst());
        String url = "https://www.googleapis.com/books/v1/volumes?q=" + encode(q) + "&maxResults=3&key=" + encode(properties.metadataProviders().googleApiKey());
        return cached("GOOGLE_BOOKS", url.replace(properties.metadataProviders().googleApiKey(), "[KEY]"), () -> {
            JsonNode root = getJson(url);
            List<MetadataCandidate> values = new ArrayList<>();
            for (JsonNode item : root.path("items")) {
                JsonNode node = item.path("volumeInfo");
                String isbn = null;
                for (JsonNode identifier : node.path("industryIdentifiers")) {
                    if (identifier.path("type").asText().startsWith("ISBN")) { isbn = identifier.path("identifier").asText(); break; }
                }
                String cover = text(node.path("imageLinks"), "thumbnail");
                values.add(new MetadataCandidate(text(item, "id"), MetadataSource.GOOGLE_BOOKS, text(node, "title"), text(node, "subtitle"),
                        strings(node.path("authors")), text(node, "publisher"), text(node, "publishedDate"), isbn,
                        text(node, "description"), strings(node.path("categories")), cover));
            }
            return values;
        });
    }

    private MetadataDraft fillBlanks(MetadataDraft local, List<MetadataCandidate> candidates) {
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
            if (blank(title) && !blank(candidate.title())) { title = candidate.title(); sources.put("title", candidate.provider()); }
            if (blank(subtitle) && !blank(candidate.subtitle())) { subtitle = candidate.subtitle(); sources.put("subtitle", candidate.provider()); }
            if (authors.isEmpty() && candidate.authors() != null && !candidate.authors().isEmpty()) { authors = candidate.authors(); sources.put("authors", candidate.provider()); }
            if (blank(publisher) && !blank(candidate.publisher())) { publisher = candidate.publisher(); sources.put("publisher", candidate.provider()); }
            if (blank(date) && !blank(candidate.publishedDate())) { date = candidate.publishedDate(); sources.put("publishedDate", candidate.provider()); }
            if (blank(isbn) && !blank(candidate.isbn())) { isbn = candidate.isbn(); sources.put("isbn", candidate.provider()); }
            if (blank(description) && !blank(candidate.description())) { description = candidate.description(); sources.put("description", candidate.provider()); }
            if (tags.isEmpty() && candidate.tags() != null && !candidate.tags().isEmpty()) { tags = candidate.tags(); sources.put("tags", candidate.provider()); }
        }
        return new MetadataDraft(title, subtitle, authors.isEmpty() ? local.authors() : authors, local.translators(), local.language(), publisher, date, isbn,
                description, local.series(), local.seriesIndex(), tags, local.pageCount(), local.wordCount(), sources, local.targetPath());
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

    private List<MetadataCandidate> cached(String provider, String cacheInput, CandidateSupplier supplier) throws Exception {
        String hash = "sha256:" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(cacheInput.getBytes(StandardCharsets.UTF_8)));
        String cached = uploads.cached(provider, hash);
        if (cached != null) return json.readValue(cached, new TypeReference<>() {});
        List<MetadataCandidate> value = supplier.get();
        uploads.cache(provider, hash, json.writeValueAsString(value), OffsetDateTime.now().plusDays(30));
        return value;
    }

    private List<MetadataCandidate> safely(String provider, CandidateSupplier supplier) {
        try { return supplier.get(); }
        catch (Exception ignored) { return List.of(); }
    }

    private JsonNode getJson(String url) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(5)).header("User-Agent", "BookKin/1.0").GET().build();
        var response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() != 200) throw new IllegalStateException("metadata provider returned " + response.statusCode());
        return json.readTree(response.body());
    }

    private void assertCoverHost(URI uri) {
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || (!COVER_HOSTS.contains(host) && !host.endsWith(".googleusercontent.com"))) {
            throw new IllegalArgumentException("在线封面来源不受信任");
        }
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
    @FunctionalInterface private interface CandidateSupplier { List<MetadataCandidate> get() throws Exception; }
}
