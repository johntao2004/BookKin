package com.elexvx.bookkin.common;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ApiDiagnosticsTest {
    @RestController
    static class Failures {
        @GetMapping("/test/crash") String crash() { throw new IllegalStateException("private-path-and-secret"); }
        @GetMapping("/test/input") String input(@RequestParam("value") String value) { return value; }
        @GetMapping("/test/uuid") String uuid(@RequestParam("value") java.util.UUID value) { return value.toString(); }
        @GetMapping("/test/missing") String missing() { throw ApiException.notFound("BOOK_NOT_FOUND", "书籍不存在。"); }
        @GetMapping("/test/denied") String denied() { throw new org.springframework.security.access.AccessDeniedException("private"); }
        @GetMapping("/test/unavailable") String unavailable() { throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "private"); }
    }
    private final org.springframework.test.web.servlet.MockMvc mvc = MockMvcBuilders.standaloneSetup(new Failures())
        .setControllerAdvice(new ApiExceptionHandler()).addFilters(new RequestTraceFilter()).build();

    @Test void unexpectedErrorsExposeStableDiagnosticsWithoutInternalDetails() throws Exception {
        var response = mvc.perform(get("/test/crash").header("X-Request-ID", "untrusted-client-id"))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
            .andExpect(jsonPath("$.detail").value("服务器处理请求时发生异常，请管理员凭请求标识查询服务日志。"))
            .andReturn().getResponse();
        var trace = response.getHeader("X-Request-ID");
        assertThat(trace).matches("[a-f0-9-]{36}").isNotEqualTo("untrusted-client-id");
        assertThat(response.getContentAsString()).contains(trace).doesNotContain("private-path-and-secret", "IllegalStateException");
        assertThat(MDC.get("traceId")).isNull();
    }
    @Test void frameworkBadRequestsAndBusinessNotFoundKeepTheirActualStatuses() throws Exception {
        mvc.perform(get("/test/input")).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("HTTP_400")).andExpect(jsonPath("$.traceId").isString());
        mvc.perform(get("/test/uuid").param("value", "not-a-uuid")).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_FAILED")).andExpect(jsonPath("$.traceId").isString());
        mvc.perform(get("/test/missing")).andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("BOOK_NOT_FOUND")).andExpect(jsonPath("$.traceId").isString());
        mvc.perform(get("/test/denied")).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("HTTP_403"));
        mvc.perform(get("/test/unavailable")).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("HTTP_503"));
    }
}
