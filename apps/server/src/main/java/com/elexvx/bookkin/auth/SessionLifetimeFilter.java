package com.elexvx.bookkin.auth;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
@Component
@Profile("api")
public class SessionLifetimeFilter extends OncePerRequestFilter {
    private final SessionLifecycleService service;
    public SessionLifetimeFilter(SessionLifecycleService service) {this.service=service;}
    // API 过期时清除服务端身份；登录和 CSRF 入口仍放行以支持重新认证。
    // Expired API sessions clear server-side identity; login and CSRF endpoints remain reachable for reauthentication.
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        var session=request.getSession(false);
        if(session!=null && request.getRequestURI().startsWith("/api/") && service.status(session).expiresAt()<=System.currentTimeMillis()) {
            session.invalidate(); SecurityContextHolder.clearContext();
            if(request.getRequestURI().equals("/api/v1/auth/login") || request.getRequestURI().equals("/api/v1/auth/csrf")) {chain.doFilter(request,response);return;}
            response.setStatus(401); response.setContentType("application/problem+json");
            response.getWriter().write("{\"code\":\"SESSION_EXPIRED\",\"detail\":\"Session expired\"}"); return;
        }
        chain.doFilter(request,response);
    }
}
