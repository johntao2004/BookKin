package com.elexvx.silvae.auth;

import com.elexvx.silvae.users.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

/** Denies every API operation until the first owner has been created. */
public final class InitializationRequiredFilter extends OncePerRequestFilter {
    private final UserRepository users;

    public InitializationRequiredFilter(UserRepository users) {
        this.users = users;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/v1/")) return true;
        return path.equals("/api/v1/auth/setup")
                || path.equals("/api/v1/auth/setup-status")
                || path.equals("/api/v1/auth/csrf")
                || path.equals("/api/v1/auth/password-policy");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            if (users.count() == 0) {
                response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                response.setCharacterEncoding("UTF-8");
                response.setContentType("application/problem+json");
                response.getWriter().write("{\"code\":\"SETUP_REQUIRED\",\"detail\":\"请先完成系统初始化。\"}");
                return;
            }
        } catch (RuntimeException unavailable) {
            // Fail closed when the initialization state cannot be read.
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.setCharacterEncoding("UTF-8");
            response.setContentType("application/problem+json");
            response.getWriter().write("{\"code\":\"SETUP_STATUS_UNAVAILABLE\",\"detail\":\"暂时无法确认系统初始化状态。\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
