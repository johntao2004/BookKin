package com.elexvx.bookkin.vault;

import com.elexvx.bookkin.auth.TwoFactorService;
import jakarta.servlet.http.*;
import org.springframework.context.annotation.*;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.*;

/** Every vault route, including ciphertext/config reads, must pass server-side step-up. */
@Configuration @Profile("api")
public class VaultAccessConfiguration implements WebMvcConfigurer {
    private final TwoFactorService factors;
    public VaultAccessConfiguration(TwoFactorService factors) { this.factors=factors; }
    @Override public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override public boolean preHandle(HttpServletRequest request,HttpServletResponse response,Object handler) {
                response.setHeader("Cache-Control","no-store");
                factors.requireVaultAccess(request.getUserPrincipal(),request.getSession(false)); return true;
            }
        }).addPathPatterns("/api/v1/vault/**");
        registry.addInterceptor(new HandlerInterceptor() {
            @Override public boolean preHandle(HttpServletRequest request,HttpServletResponse response,Object handler) {
                response.setHeader("Cache-Control","no-store"); return true;
            }
        }).addPathPatterns("/api/v1/auth/two-factor/**");
    }
}
