package io.github.johntao2004.bookkin.auth;

import io.github.johntao2004.bookkin.audit.AuditService;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.users.BookKinUser;
import io.github.johntao2004.bookkin.users.UserRepository;
import io.github.johntao2004.bookkin.users.UserRole;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.security.Principal;
import java.util.Locale;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final AuthenticationManager authenticationManager;
    private final HttpSessionSecurityContextRepository contextRepository;
    private final LoginRateLimiter rateLimiter;
    private final AuditService audit;

    public AuthController(UserRepository users, PasswordEncoder passwords, AuthenticationManager authenticationManager,
                          HttpSessionSecurityContextRepository contextRepository, LoginRateLimiter rateLimiter,
                          AuditService audit) {
        this.users = users;
        this.passwords = passwords;
        this.authenticationManager = authenticationManager;
        this.contextRepository = contextRepository;
        this.rateLimiter = rateLimiter;
        this.audit = audit;
    }

    @GetMapping("/csrf")
    CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getToken(), token.getHeaderName());
    }

    @GetMapping("/setup-status")
    SetupStatus setupStatus() {
        return new SetupStatus(users.count() > 0);
    }

    @PostMapping("/setup")
    SessionUser setup(@Valid @RequestBody SetupRequest input, HttpServletRequest request, HttpServletResponse response) {
        if (!isTrustedSetupAddress(request.getRemoteAddr())) {
            throw ApiException.forbidden("SETUP_NETWORK_FORBIDDEN", "主人初始化只允许从 NAS 本机或局域网访问。");
        }
        var created = users.createOwnerIfEmpty(input.username(), input.displayName(), passwords.encode(input.password()))
                .orElseThrow(() -> ApiException.conflict("ALREADY_INITIALIZED", "BookKin已经完成初始化。"));
        authenticateAndSave(created.username(), input.password(), request, response);
        audit.record(created.id(), "OWNER_INITIALIZED", "USER", created.id().toString(), null, null, null, null,
                "SUCCEEDED", "{}");
        return SessionUser.from(created);
    }

    @PostMapping("/login")
    SessionUser login(@Valid @RequestBody LoginRequest input, HttpServletRequest request, HttpServletResponse response) {
        String key = request.getRemoteAddr() + ":" + input.username().toLowerCase(Locale.ROOT);
        rateLimiter.check(key);
        try {
            authenticateAndSave(input.username(), input.password(), request, response);
            var user = users.findByUsername(input.username()).orElseThrow();
            users.recordLogin(user.id());
            rateLimiter.success(key);
            audit.record(user.id(), "LOGIN", "USER", user.id().toString(), null, null, null, null, "SUCCEEDED", "{}");
            return SessionUser.from(user);
        } catch (AuthenticationException exception) {
            rateLimiter.failure(key);
            audit.record(users.findByUsername(input.username()).map(BookKinUser::id).orElse(null), "LOGIN", "USER",
                    input.username().toLowerCase(Locale.ROOT), null, null, null, null, "FAILED", "{}");
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "用户名或密码不正确。");
        }
    }

    @GetMapping("/session")
    SessionUser session(Principal principal) {
        return SessionUser.from(current(principal));
    }

    @PutMapping("/password")
    SessionUser changePassword(@Valid @RequestBody ChangePasswordRequest input, Principal principal) {
        var user = current(principal);
        if (!passwords.matches(input.currentPassword(), user.passwordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CURRENT_PASSWORD_INVALID", "当前密码不正确。");
        }
        users.updatePassword(user.id(), passwords.encode(input.newPassword()));
        audit.record(user.id(), "PASSWORD_CHANGED", "USER", user.id().toString(), null, null, null, null,
                "SUCCEEDED", "{}");
        return SessionUser.from(users.findById(user.id()).orElseThrow());
    }

    @PostMapping("/logout")
    void logout(HttpServletRequest request, HttpServletResponse response) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        var user = authentication == null ? null : users.findByUsername(authentication.getName()).orElse(null);
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        if (user != null) audit.record(user.id(), "LOGOUT", "USER", user.id().toString(), null, null, null, null,
                "SUCCEEDED", "{}");
    }

    private BookKinUser current(Principal principal) {
        if (principal == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "AUTH_REQUIRED", "请先登录。");
        return users.findByUsername(principal.getName()).orElseThrow();
    }

    private void authenticateAndSave(String username, String password, HttpServletRequest request, HttpServletResponse response) {
        var authentication = authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(username, password));
        request.getSession(true);
        request.changeSessionId();
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contextRepository.saveContext(context, request, response);
    }

    static boolean isTrustedSetupAddress(String remoteAddress) {
        if (remoteAddress == null) return false;
        String literal = remoteAddress.contains("%") ? remoteAddress.substring(0, remoteAddress.indexOf('%')) : remoteAddress;
        if (!literal.matches("[0-9a-fA-F:.]+")) return false;
        try {
            InetAddress address = InetAddress.getByName(literal);
            if (address.isAnyLocalAddress() || address.isLoopbackAddress()
                    || address.isLinkLocalAddress() || address.isSiteLocalAddress()) return true;
            byte[] bytes = address.getAddress();
            return bytes.length == 16 && (bytes[0] & 0xfe) == 0xfc;
        } catch (UnknownHostException exception) {
            return false;
        }
    }

    public record CsrfResponse(String token, String headerName) {}
    public record SetupStatus(boolean initialized) {}
    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}
    public record SetupRequest(
            @NotBlank @Pattern(regexp = "[a-zA-Z0-9._-]{3,80}") String username,
            @NotBlank @Size(max = 120) String displayName,
            @Size(min = 12, max = 200) String password) {}
    public record ChangePasswordRequest(@NotBlank String currentPassword, @Size(min = 12, max = 200) String newPassword) {}
    public record SessionUser(String id, String username, String displayName, UserRole role, boolean mustChangePassword) {
        static SessionUser from(BookKinUser user) {
            return new SessionUser(user.id().toString(), user.username(), user.displayName(), user.role(), user.mustChangePassword());
        }
    }
}
