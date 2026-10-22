package com.elexvx.bookkin.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Server-generated correlation IDs connect public diagnostics to private server logs. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestTraceFilter extends OncePerRequestFilter {
    @Override protected boolean shouldNotFilterAsyncDispatch() { return false; }
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var traceId = request.getAttribute("bookkin.traceId") instanceof String existing ? existing : UUID.randomUUID().toString();
        request.setAttribute("bookkin.traceId", traceId);
        response.setHeader("X-Request-ID", traceId);
        var previous = MDC.get("traceId");
        MDC.put("traceId", traceId);
        try { chain.doFilter(request, response); }
        finally { if (previous == null) MDC.remove("traceId"); else MDC.put("traceId", previous); }
    }
}
