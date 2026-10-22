package com.elexvx.bookkin.auth;
import com.elexvx.bookkin.users.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
/** Re-read the current role on every API request; a historical session never preserves revoked authority. */
public class RolePermissionFilter extends OncePerRequestFilter {
    private final UserRepository users;
    private final RolePermissionService permissions;
    public RolePermissionFilter(UserRepository users, RolePermissionService permissions) { this.users = users; this.permissions = permissions; }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!request.getRequestURI().startsWith("/api/v1/") || authentication == null || authentication instanceof AnonymousAuthenticationToken || !authentication.isAuthenticated()) {
            chain.doFilter(request, response); return;
        }
        var user = users.findByUsername(authentication.getName()).orElse(null);
        if (user == null || user.status() != UserStatus.ACTIVE) {
            SecurityContextHolder.clearContext();
            var session = request.getSession(false); if (session != null) session.invalidate();
            response.setStatus(401); response.setContentType("application/problem+json;charset=UTF-8");
            response.getWriter().write("{\"code\":\"AUTH_REQUIRED\",\"detail\":\"请重新登录。\"}"); return;
        }
        var current = UsernamePasswordAuthenticationToken.authenticated(authentication.getPrincipal(), null,
            List.of(new SimpleGrantedAuthority("ROLE_" + user.role().name())));
        current.setDetails(authentication.getDetails());
        var context = SecurityContextHolder.createEmptyContext(); context.setAuthentication(current); SecurityContextHolder.setContext(context);
        var required = ApiPermissionPolicy.required(request.getMethod(), request.getRequestURI());
        if (!required.isEmpty() && java.util.Collections.disjoint(required, permissions.snapshot(current).grants())) {
            response.setStatus(403); response.setContentType("application/problem+json;charset=UTF-8");
            response.getWriter().write("{\"code\":\"PERMISSION_DENIED\",\"detail\":\"当前角色没有此功能的权限。\"}"); return;
        }
        chain.doFilter(request, response);
    }
}
