package io.github.johntao2004.bookkin.users;

import io.github.johntao2004.bookkin.audit.AuditService;
import io.github.johntao2004.bookkin.common.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/users")
@PreAuthorize("hasAnyRole('OWNER','ADMIN')")
public class UserController {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final AuditService audit;
    private final SecureRandom random = new SecureRandom();

    public UserController(UserRepository users, PasswordEncoder passwords, AuditService audit) {
        this.users = users;
        this.passwords = passwords;
        this.audit = audit;
    }

    @GetMapping
    UserList list() {
        return new UserList(users.findAll().stream().map(ManagedUser::from).toList());
    }

    @PostMapping
    CreatedUser create(@Valid @RequestBody CreateUser input, Principal principal) {
        var actor = actor(principal);
        if (input.role() == UserRole.OWNER) throw ApiException.forbidden("OWNER_CREATION_FORBIDDEN", "系统只能有一个主人账户。");
        if (input.role() == UserRole.ADMIN && actor.role() != UserRole.OWNER) {
            throw ApiException.forbidden("OWNER_REQUIRED", "只有主人可以创建管理员。");
        }
        if (users.findByUsername(input.username()).isPresent()) throw ApiException.conflict("USERNAME_EXISTS", "用户名已存在。");
        String temporaryPassword = temporaryPassword();
        var user = users.create(input.username(), input.displayName(), passwords.encode(temporaryPassword), input.role(), true);
        audit.record(actor.id(), "USER_CREATED", "USER", user.id().toString(), null, null, null, null, "SUCCEEDED", "{}");
        return new CreatedUser(ManagedUser.from(user), temporaryPassword);
    }

    @PatchMapping("/{id}/status")
    ManagedUser toggle(@PathVariable UUID id, Principal principal) {
        var actor = actor(principal);
        var target = users.findById(id).orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "用户不存在。"));
        ensureCanManage(actor, target);
        if (target.role() == UserRole.OWNER) throw ApiException.forbidden("OWNER_DISABLE_FORBIDDEN", "主人账户不能停用。");
        if (target.id().equals(actor.id())) throw ApiException.conflict("SELF_DISABLE_FORBIDDEN", "不能停用当前登录账户。");
        var updated = users.toggleStatus(id);
        audit.record(actor.id(), "USER_STATUS_CHANGED", "USER", target.id().toString(), null, null, null, null,
                "SUCCEEDED", "{\"status\":\"" + updated.status().name() + "\"}");
        return ManagedUser.from(updated);
    }

    @PostMapping("/{id}/temporary-password")
    TemporaryPassword resetTemporaryPassword(@PathVariable UUID id, Principal principal) {
        var actor = actor(principal);
        var target = users.findById(id).orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "用户不存在。"));
        ensureCanManage(actor, target);
        if (target.id().equals(actor.id())) throw ApiException.conflict("SELF_RESET_FORBIDDEN", "请从个人账户页面修改自己的密码。");
        String temporaryPassword = temporaryPassword();
        users.setTemporaryPassword(id, passwords.encode(temporaryPassword));
        audit.record(actor.id(), "USER_TEMPORARY_PASSWORD_RESET", "USER", id.toString(), null, null, null, null,
                "SUCCEEDED", "{}");
        return new TemporaryPassword(target.username(), temporaryPassword);
    }

    @PostMapping("/{id}/sessions/revoke")
    void revokeSessions(@PathVariable UUID id, Principal principal) {
        var actor = actor(principal);
        var target = users.findById(id).orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "用户不存在。"));
        ensureCanManage(actor, target);
        if (target.id().equals(actor.id())) throw ApiException.conflict("SELF_REVOKE_FORBIDDEN", "不能从用户管理中撤销当前会话。");
        users.revokeSessions(id);
        audit.record(actor.id(), "USER_SESSIONS_REVOKED", "USER", id.toString(), null, null, null, null,
                "SUCCEEDED", "{}");
    }

    private BookKinUser actor(Principal principal) {
        return users.findByUsername(principal.getName()).orElseThrow();
    }

    private void ensureCanManage(BookKinUser actor, BookKinUser target) {
        if (actor.role() == UserRole.ADMIN && target.role() != UserRole.MEMBER) {
            throw ApiException.forbidden("OWNER_REQUIRED", "管理员只能管理成员账户。");
        }
    }

    private String temporaryPassword() {
        byte[] bytes = new byte[12];
        random.nextBytes(bytes);
        return "BookKin-" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes) + "!7";
    }

    public record CreateUser(
            @NotBlank @Pattern(regexp = "[a-z0-9._-]{3,80}") String username,
            @NotBlank @Size(max = 120) String displayName,
            @NotNull UserRole role) {}
    public record CreatedUser(ManagedUser user, String temporaryPassword) {}
    public record TemporaryPassword(String username, String temporaryPassword) {}
    public record UserList(List<ManagedUser> items) {}
    public record ManagedUser(String id, String username, String displayName, UserRole role, UserStatus status,
                              boolean mustChangePassword, OffsetDateTime createdAt, OffsetDateTime lastLoginAt) {
        static ManagedUser from(BookKinUser user) {
            return new ManagedUser(user.id().toString(), user.username(), user.displayName(), user.role(), user.status(),
                    user.mustChangePassword(), user.createdAt(), user.lastLoginAt());
        }
    }
}
