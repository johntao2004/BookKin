package com.elexvx.bookkin.web;

import com.elexvx.bookkin.users.SiteSettingsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** HTML responses enforce the saved policy even for crawlers without JavaScript. */
@Component
@Profile("api")
public class SiteIndexingFilter extends OncePerRequestFilter {
    private final SiteSettingsService settings;
    public SiteIndexingFilter(SiteSettingsService settings) {this.settings=settings;}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        String path=request.getRequestURI();
        if(!path.startsWith("/api/") && !path.startsWith("/assets/") && !path.equals("/robots.txt")) {
            boolean publicPage=path.equals("/")||path.equals("/index.html")||path.equals("/library")||path.startsWith("/categories")||path.startsWith("/booklists")||path.startsWith("/articles");
            response.setHeader("X-Robots-Tag",publicPage&&settings.current().allowIndexing()?"index, follow":"noindex, nofollow");
        }
        chain.doFilter(request,response);
    }
}
