package com.elexvx.bookkin.articles;

import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.UserRepository;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class ArticleNotesService {
    private static final Set<String> ENTRY_TYPES = Set.of("NOTE", "HIGHLIGHT");
    private static final Set<String> STYLES = Set.of("HIGHLIGHT", "UNDERLINE", "BOLD");
    private static final Set<String> COLORS = Set.of("YELLOW", "GREEN", "PINK", "BLUE", "ORANGE", "CORAL", "GOLD", "TEAL");

    private final DSLContext db;
    private final UserRepository users;
    private final ObjectMapper json;

    public ArticleNotesService(DSLContext db, UserRepository users, ObjectMapper json) {
        this.db = db;
        this.users = users;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public List<ArticleNotes> notes(Principal principal) {
        if (principal == null) throw ApiException.forbidden("AUTH_REQUIRED", "请先登录。");
        var user = users.findByUsername(principal.getName())
                .orElseThrow(() -> ApiException.forbidden("AUTH_REQUIRED", "请先登录。"));

        // One user-scoped query loads readable articles and their own reading state; parsing never falls back to another user's row.
        var rows = db.fetch("""
                select a.id as article_id, a.title, a.author, a.cover_asset_id, ar.state::text as state
                  from article_reading ar
                  join articles a on a.id = ar.article_id
                 where ar.user_id = ?
                   and (a.visibility = 'PUBLIC' or a.owner_id = ? or ?)
                 order by a.created_at desc, a.id
                """, user.id(), user.id(), user.canManageFiles());

        var result = new ArrayList<ArticleNotes>();
        for (var row : rows) {
            List<Entry> entries = parseEntries(row.get("state", String.class));
            if (entries.isEmpty()) continue;
            UUID coverId = row.get("cover_asset_id", UUID.class);
            result.add(new ArticleNotes(row.get("article_id", UUID.class), row.get("title", String.class),
                    row.get("author", String.class), coverId == null ? null : "/api/v1/articles/assets/" + coverId,
                    entries));
        }
        return List.copyOf(result);
    }

    List<Entry> parseEntries(String state) {
        if (state == null || state.isBlank()) return List.of();
        try {
            JsonNode root = json.readTree(state);
            JsonNode rawEntries = root != null && root.isObject() ? root.path("annotations") : null;
            if (rawEntries == null || !rawEntries.isArray()) return List.of();
            var entries = new ArrayList<Entry>();
            for (JsonNode raw : rawEntries) {
                Entry entry = parseEntry(raw);
                if (entry != null) entries.add(entry);
            }
            return List.copyOf(entries);
        } catch (Exception malformedState) {
            // Bad legacy state must not break the notes feed or reveal fields from a different row.
            return List.of();
        }
    }

    private Entry parseEntry(JsonNode raw) {
        if (raw == null || !raw.isObject()) return null;
        String id = text(raw, "id");
        String type = text(raw, "type");
        String quote = text(raw, "quote");
        String note = text(raw, "note");
        String locator = text(raw, "locator");
        String createdAt = text(raw, "createdAt");
        if (id == null || !ENTRY_TYPES.contains(type) || quote == null || note == null || locator == null || createdAt == null) return null;
        try {
            OffsetDateTime.parse(createdAt);
        } catch (DateTimeParseException invalidTimestamp) {
            return null;
        }
        if (quote.isBlank() && note.isBlank()) return null;
        String style = raw.has("style") ? optionalEnum(raw, "style", STYLES) : "HIGHLIGHT";
        String color = raw.has("color") ? optionalEnum(raw, "color", COLORS) : "YELLOW";
        if (raw.has("style") && style == null || raw.has("color") && color == null) return null;
        return new Entry(id, type, quote, note, locator, style, color, createdAt);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isTextual() ? value.asText() : null;
    }

    private static String optionalEnum(JsonNode node, String field, Set<String> allowed) {
        if (!node.has(field)) return null;
        String value = text(node, field);
        return value != null && allowed.contains(value) ? value : null;
    }

    public record ArticleNotes(UUID articleId, String title, String author, String coverUrl, List<Entry> annotations) {}
    public record Entry(String id, String type, String quote, String note, String locator,
                        String style, String color, String createdAt) {}
}
