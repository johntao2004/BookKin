package com.elexvx.bookkin.auth;

import com.elexvx.bookkin.users.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

// 临时密码身份仅可进入恢复及改密相关白名单，其他 API 返回 428。
// Temporary-password identities are restricted to the recovery/password allowlist; other APIs return 428.
@Component
@Profile("api")
public class MustChangePasswordFilter extends OncePerRequestFilter {
    private final UserRepository users;

    public MustChangePasswordFilter(UserRepository users) {
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        String path = request.getRequestURI();
        if (!path.startsWith("/api/")) {
            chain.doFilter(request, response);
            return;
        }
        boolean passwordRoute = ("GET".equals(request.getMethod()) && path.equals("/api/v1/site-settings")) || path.equals("/api/v1/auth/session-status") || path.equals("/api/v1/auth/password-policy") || path.equals("/api/v1/auth/password") || path.equals("/api/v1/auth/session")
                || path.equals("/api/v1/auth/logout") || path.equals("/api/v1/auth/csrf")
                || path.equals("/api/v1/auth/recovery/request") || path.equals("/api/v1/auth/recovery/verify")
                || path.equals("/api/v1/auth/recovery/reset") || path.equals("/change-password") || path.startsWith("/assets/");
        if (!passwordRoute && authentication != null && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken)) {
            var user = users.findByUsername(authentication.getName()).orElse(null);
            if (user != null && user.mustChangePassword()) {
                response.setStatus(428);
                response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                response.setContentType("application/problem+json");
                response.getWriter().write("{\"title\":\"必须先修改密码\",\"detail\":\"临时密码只能用于首次登录。\",\"code\":\"PASSWORD_CHANGE_REQUIRED\"}");
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
