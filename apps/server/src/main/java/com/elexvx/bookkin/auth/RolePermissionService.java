package com.elexvx.bookkin.auth;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.*;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import java.security.Principal;
import java.util.*;
import org.jooq.DSLContext;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Authoritative role grants. Object ownership, private reading data and NAS checks remain mandatory. */
@Service
public class RolePermissionService {
    public record Definition(String code, String group, String label, String kind, List<UserRole> roles, List<String> requires) {}
    public record Policy(long revision, Map<UserRole, Set<String>> grants) {}
    public record Snapshot(UserRole role, long revision, Set<String> grants) {}
    private final DSLContext dsl;
    private final UserRepository users;
    private final AuditService audit;
    private final ObjectMapper json = new ObjectMapper();
    private final List<Definition> definitions;

    public RolePermissionService(DSLContext dsl, UserRepository users, AuditService audit) {
        this.dsl = dsl; this.users = users; this.audit = audit;
        try (var stream = new ClassPathResource("role-permissions.json").getInputStream()) {
            definitions = List.copyOf(json.readValue(stream, new TypeReference<List<Definition>>() {}));
        } catch (Exception e) { throw new IllegalStateException("Cannot load permission catalog", e); }
    }
    public List<Definition> definitions() { return definitions; }
    public Set<String> defaults(UserRole role) {
        var result = new LinkedHashSet<String>();
        definitions.stream().filter(d -> d.roles().contains(role)).forEach(d -> result.add(d.code()));
        return result;
    }
    public Policy policy() {
        var row = dsl.fetchOne("select revision, grants::text as grants from role_permission_policy where id = 1");
        try {
            var stored = json.readTree(row.get("grants", String.class));
            int modelVersion = stored.has("_permissionModelVersion") ? stored.get("_permissionModelVersion").asInt() : 0;
            boolean versioned = modelVersion > 0;
            var storedGrants = stored.has("grants") ? stored.get("grants") : stored;
            var grants = new EnumMap<UserRole, Set<String>>(UserRole.class);
            for (var role : UserRole.values()) {
                var allowed = defaults(role);
                var configured = storedGrants.get(role.name());
                if (role != UserRole.OWNER && configured != null && configured.isArray()) {
                    var configuredCodes = new LinkedHashSet<String>(); configured.forEach(value -> { if (value.isTextual()) configuredCodes.add(value.asText()); });
                    allowed.retainAll(configuredCodes);
                }
                // Old policies have no model marker. Preserve their former catalog/search and download access
                // exactly once; after the next save, omitted new codes mean intentionally disabled.
                if (!versioned && role != UserRole.OWNER) {
                    if (allowed.contains("library.view")) allowed.add("library.query");
                    if (allowed.contains("reader.read")) allowed.add("library.download");
                }
                // New page scopes retain their former parent access when loading an unversioned or v2 policy.
                // Once saved as v3, omissions represent intentional revocations.
                if (modelVersion < 3 && role != UserRole.OWNER) {
                    inherit(allowed, "library.details.view", "library.view");
                    inherit(allowed, "library.search.view", "library.query");
                    inherit(allowed, "booklists.details.view", "booklists.view");
                    inherit(allowed, "articles.read", "articles.view");
                    inherit(allowed, "articles.collections.view", "articles.view");
                    inherit(allowed, "articles.collections.details.view", "articles.view");
                    inherit(allowed, "notes.books.view", "notes.view");
                    inherit(allowed, "notes.articles.view", "notes.view");
                    inherit(allowed, "notes.posts.view", "notes.view");
                    inherit(allowed, "settings.metadata.view", "settings.ai.view");
                    inherit(allowed, "settings.metadata.edit", "settings.ai.edit");
                }
                if (modelVersion < 4 && role != UserRole.OWNER && allowed.contains("articles.read")) {
                    allowed.add("articles.annotate");
                }
                if (modelVersion < 4 && role != UserRole.OWNER && allowed.contains("vault.use")) {
                    allowed.addAll(Set.of("vault.read", "vault.upload", "vault.delete"));
                }
                // Never allow a stale/invalid persisted action without its prerequisites.
                boolean changed;
                do { changed = allowed.removeIf(code -> !allowed.containsAll(definition(code).requires())); } while (changed);
                grants.put(role, Set.copyOf(allowed));
            }
            return new Policy(row.get("revision", Long.class), grants);
        } catch (Exception e) { throw new IllegalStateException("Cannot load permission policy", e); }
    }
    private Definition definition(String code) { return definitions.stream().filter(d -> d.code().equals(code)).findFirst().orElseThrow(); }
    private void inherit(Set<String> allowed, String child, String parent) {
        if (allowed.contains(parent)) allowed.add(child);
    }
    public Snapshot snapshot(Principal principal) {
        var user = actor(principal); var policy = policy();
        return new Snapshot(user.role(), policy.revision(), policy.grants().get(user.role()));
    }
    public BookKinUser actor(Principal principal) {
        if (principal == null) throw ApiException.forbidden("ACCESS_DENIED", "无权执行此操作。");
        return users.findByUsername(principal.getName()).filter(u -> u.status() == UserStatus.ACTIVE)
            .orElseThrow(() -> ApiException.forbidden("ACCESS_DENIED", "无权执行此操作。"));
    }
    public void require(Principal principal, String code) {
        if (!snapshot(principal).grants().contains(code)) throw ApiException.forbidden("PERMISSION_DENIED", "当前角色没有此功能的权限。");
    }
    @Transactional
    public Policy update(Policy input, Principal principal) {
        var actor = actor(principal);
        if (actor.role() != UserRole.OWNER) throw ApiException.forbidden("OWNER_REQUIRED", "只有主人可以配置角色权限。");
        if (input.grants() == null || !input.grants().keySet().equals(Set.of(UserRole.ADMIN, UserRole.MEMBER)))
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "INVALID_ROLE_POLICY", "请提供管理员和成员的完整权限配置。");
        for (var entry : input.grants().entrySet()) {
            if (entry.getValue() == null || !defaults(entry.getKey()).containsAll(entry.getValue()))
                throw ApiException.forbidden("ROLE_PERMISSION_CEILING", "权限超出该角色可授权的安全边界。");
            for (var code : entry.getValue()) if (!entry.getValue().containsAll(definition(code).requires()))
                throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "PERMISSION_DEPENDENCY", "请先开启功能对应的页面访问权限。");
        }
        try {
            var envelope = new LinkedHashMap<String, Object>();
            envelope.put("_permissionModelVersion", 4);
            envelope.put("grants", input.grants());
            int changed = dsl.execute("update role_permission_policy set grants = ?::jsonb, revision = revision + 1, updated_by = ?, updated_at = now() where id = 1 and revision = ?",
                json.writeValueAsString(envelope), actor.id(), input.revision());
            if (changed != 1) throw ApiException.conflict("ROLE_POLICY_CONFLICT", "权限配置已更新，请重新加载后再保存。");
            audit.record(actor.id(), "ROLE_PERMISSIONS_UPDATED", "ROLE_POLICY", "1", null, null, null, null, "SUCCEEDED", json.writeValueAsString(input.grants()));
            return policy();
        } catch (tools.jackson.core.JacksonException e) { throw new IllegalStateException(e); }
    }
}
