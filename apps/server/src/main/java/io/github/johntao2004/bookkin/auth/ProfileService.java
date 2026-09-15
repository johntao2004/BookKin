package io.github.johntao2004.bookkin.auth;

import io.github.johntao2004.bookkin.audit.AuditService;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.users.BookKinUser;
import io.github.johntao2004.bookkin.users.UserRepository;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;

@org.springframework.context.annotation.Profile("api")
@Service
public class ProfileService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final AuditService audit;
    public ProfileService(UserRepository users, PasswordEncoder passwords, AuditService audit) {
        this.users = users; this.passwords = passwords; this.audit = audit;
    }
    @Transactional
    public BookKinUser update(String actor, String username, String displayName, String currentPassword) {
        var user = users.findByUsername(actor).orElseThrow(() -> ApiException.forbidden("AUTH_REQUIRED", "请重新登录。"));
        if (!passwords.matches(currentPassword, user.passwordHash()))
            throw ApiException.forbidden("CURRENT_PASSWORD_INVALID", "当前密码不正确。");
        String normalized = username.toLowerCase(Locale.ROOT);
        if (users.findByUsername(normalized).filter(other -> !other.id().equals(user.id())).isPresent())
            throw ApiException.conflict("USERNAME_EXISTS", "用户名已被使用，请选择其他用户名。");
        var updated = users.updateProfile(user.id(), normalized, displayName.trim());
        if (!user.username().equals(normalized)) users.revokeSessionsByUsername(user.username());
        audit.record(user.id(), "PROFILE_UPDATED", "USER", user.id().toString(), null, null, null, null, "SUCCEEDED", "{}");
        return updated;
    }
}
