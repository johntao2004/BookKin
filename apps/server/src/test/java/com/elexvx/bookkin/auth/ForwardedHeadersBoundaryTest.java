package com.elexvx.bookkin.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.UserRepository;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.tomcat.autoconfigure.servlet.TomcatServletWebServerAutoConfiguration;
import org.springframework.boot.web.server.autoconfigure.ServerProperties;
import org.springframework.boot.web.server.servlet.context.ServletWebServerApplicationContext;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.security.authentication.BadCredentialsException;

/** Real Boot/Tomcat requests exercise the production forwarding configuration, not a filter-free mock. */
class ForwardedHeadersBoundaryTest {
    private static ServletWebServerApplicationContext context;
    private static URI base;
    private static final HttpClient client = HttpClient.newHttpClient();

    @BeforeAll
    static void startServer() {
        context = (ServletWebServerApplicationContext) new SpringApplicationBuilder(TestServer.class)
                .web(WebApplicationType.SERVLET).run("--server.port=0", "--spring.main.banner-mode=off");
        base = URI.create("http://localhost:" + context.getWebServer().getPort());
    }

    @AfterAll
    static void stopServer() {
        if (context != null) context.close();
    }

    @Test
    void bothHeaderFamiliesAndChainsCannotChangeTheSocketPeer() throws Exception {
        var control = get("/address", null, null);
        assertThat(control.statusCode()).isEqualTo(200);
        assertThat(AuthController.isTrustedSetupAddress(control.body())).isTrue();
        for (var headers : List.of(
                List.of("Forwarded", "for=192.168.1.20;proto=https;host=evil.example"),
                List.of("Forwarded", "for=203.0.113.9, for=192.168.1.20"),
                List.of("Forwarded", "for=\"[::1]\""),
                List.of("X-Forwarded-For", "192.168.1.20"),
                List.of("X-Forwarded-For", "203.0.113.9, 127.0.0.1"),
                List.of("X-Forwarded-For", "::1"))) {
            var response = get("/address", headers.get(0), headers.get(1));
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.body()).isEqualTo(control.body());
        }
        var both = client.send(HttpRequest.newBuilder(base.resolve("/address"))
                .header("Forwarded", "for=192.168.1.20")
                .header("X-Forwarded-For", "203.0.113.9").GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(both.body()).isEqualTo(control.body());
    }

    @Test
    void rotatingSpoofedAddressesDoesNotResetTheActualLoginRateLimit() throws Exception {
        for (int attempt = 1; attempt <= 8; attempt++) {
            assertThat(get("/login", "X-Forwarded-For", "192.168.1." + attempt).statusCode()).isEqualTo(401);
        }
        assertThat(get("/login", "Forwarded", "for=10.0.0.99").statusCode()).isEqualTo(429);
    }

    private static HttpResponse<String> get(String path, String name, String value) throws Exception {
        var request = HttpRequest.newBuilder(base.resolve(path));
        if (name != null) request.header(name, value);
        return client.send(request.GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    @TestConfiguration(proxyBeanMethods = false)
    @EnableConfigurationProperties(ServerProperties.class)
    @ImportAutoConfiguration(TomcatServletWebServerAutoConfiguration.class)
    static class TestServer {
        @Bean
        ServletRegistrationBean<HttpServlet> probe() {
            var users = mock(UserRepository.class);
            var controller = new AuthController(users, null,
                    authentication -> { throw new BadCredentialsException("test-only"); },
                    null, new LoginRateLimiter(), mock(AuditService.class), null);
            return new ServletRegistrationBean<>(new HttpServlet() {
                @Override
                protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
                    if (request.getRequestURI().equals("/login")) {
                        try {
                            controller.login(new AuthController.LoginRequest("boundary-user", "invalid"), request, response);
                        } catch (ApiException exception) {
                            response.setStatus(exception.status().value());
                        }
                    } else {
                        response.getWriter().print(request.getRemoteAddr());
                    }
                }
            }, "/*");
        }
    }
}
