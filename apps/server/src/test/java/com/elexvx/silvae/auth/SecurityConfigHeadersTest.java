package com.elexvx.silvae.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class SecurityConfigHeadersTest {
    @Test
    void onlyTheMingLibrarySceneCanBeFramedByTheSameOriginHost() {
        var sceneResponse = headersFor("/assets/ming-library/index.html");
        assertThat(sceneResponse.getHeader("X-Frame-Options")).isEqualTo("SAMEORIGIN");
        assertThat(sceneResponse.getHeader("Content-Security-Policy")).contains("frame-ancestors 'self'");

        var appResponse = headersFor("/index.html");
        assertThat(appResponse.getHeader("X-Frame-Options")).isEqualTo("DENY");
        assertThat(appResponse.getHeader("Content-Security-Policy")).contains("frame-ancestors 'none'");
    }

    private MockHttpServletResponse headersFor(String path) {
        var request = new MockHttpServletRequest("GET", path);
        var response = new MockHttpServletResponse();
        SecurityConfig.securityHeaderWriters().forEach(writer -> writer.writeHeaders(request, response));
        return response;
    }
}
