package io.github.johntao2004.bookkin.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.http.HttpMethod;

@Configuration
@Profile("api")
@EnableMethodSecurity
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, HttpSessionSecurityContextRepository repository,
                                            MustChangePasswordFilter mustChangePasswordFilter) throws Exception {
        var csrf = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrf.setCookieName("XSRF-TOKEN");
        csrf.setHeaderName("X-XSRF-TOKEN");
        csrf.setCookiePath("/");

        return http
                .csrf(configurer -> configurer.csrfTokenRepository(csrf).spa())
                .securityContext(context -> context.securityContextRepository(repository).requireExplicitSave(true))
                .sessionManagement(session -> session.sessionFixation(fixation -> fixation.migrateSession()))
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers("/", "/index.html", "/login", "/setup", "/change-password", "/library", "/library/**", "/categories", "/categories/**",
                                "/booklists", "/booklists/**", "/settings/display-books", "/recycle-bin",
                                "/annotations", "/reader/**", "/admin/**", "/assets/**", "/covers/**", "/favicon.ico").permitAll()
                        .requestMatchers("/api/v1/auth/csrf", "/api/v1/auth/login", "/api/v1/auth/setup", "/api/v1/auth/setup-status", "/actuator/health/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/display-books", "/api/v1/display-books/**").permitAll()
                        .requestMatchers(HttpMethod.HEAD, "/api/v1/display-books/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/categories", "/api/v1/categories/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/booklists", "/api/v1/booklists/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/display-books/**").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/v1/display-books/**").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/display-books/**").authenticated()
                        .requestMatchers("/api/v1/users/**", "/api/v1/file-operations/**", "/api/v1/recycle-bin/**", "/api/v1/library-roots/**").hasAnyRole("OWNER", "ADMIN")
                        .requestMatchers("/actuator/**").hasRole("OWNER")
                        .anyRequest().authenticated())
                .headers(headers -> headers
                        .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"))
                        .frameOptions(frame -> frame.deny()))
                .requestCache(cache -> cache.disable())
                .formLogin(login -> login.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .addFilterAfter(mustChangePasswordFilter, org.springframework.security.web.context.SecurityContextHolderFilter.class)
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    HttpSessionSecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }
}
