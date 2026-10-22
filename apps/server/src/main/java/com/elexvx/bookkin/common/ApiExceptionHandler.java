package com.elexvx.bookkin.common;

import jakarta.validation.ConstraintViolationException;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.ErrorResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.beans.TypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;

@RestControllerAdvice
// 业务异常与参数校验异常转为 ProblemDetail，保持响应中的可识别错误码。
// Maps business and validation exceptions to ProblemDetail responses with identifiable error codes.
public class ApiExceptionHandler {
    private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);
    private ProblemDetail diagnostic(ProblemDetail problem) {
        var traceId = MDC.get("traceId");
        if (traceId != null) problem.setProperty("traceId", traceId);
        return problem;
    }
    @ExceptionHandler(ApiException.class)
    ProblemDetail apiException(ApiException exception, HttpServletRequest request) {
        var problem = ProblemDetail.forStatusAndDetail(exception.status(), exception.getMessage());
        problem.setTitle("请求无法完成");
        problem.setType(URI.create("urn:bookkin:error:" + exception.code().toLowerCase()));
        problem.setProperty("code", exception.code());
        if (exception.status().is5xxServerError()) LOG.error("API failure code={}", exception.code(), exception);
        else LOG.info("Request rejected status={} code={} method={} path={}", exception.status().value(), exception.code(), request.getMethod(), request.getRequestURI());
        return diagnostic(problem);
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, ConstraintViolationException.class,
        TypeMismatchException.class, HttpMessageNotReadableException.class, BindException.class})
    ProblemDetail validation(Exception exception, HttpServletRequest request) {
        LOG.warn("Request validation failed code=VALIDATION_FAILED method={} path={} exception={}", request.getMethod(), request.getRequestURI(), exception.getClass().getSimpleName());
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "请求字段不符合约束，请检查后重试。");
        problem.setTitle("参数校验失败");
        problem.setProperty("code", "VALIDATION_FAILED");
        return diagnostic(problem);
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail unexpected(Exception exception, HttpServletRequest request) {
        if (exception instanceof AccessDeniedException || exception instanceof AuthenticationException) {
            var status = exception instanceof AuthenticationException ? HttpStatus.UNAUTHORIZED : HttpStatus.FORBIDDEN;
            var problem = ProblemDetail.forStatusAndDetail(status, status == HttpStatus.UNAUTHORIZED
                ? "尚未登录或登录已过期。" : "当前账户没有执行此操作的权限。");
            problem.setProperty("code", "HTTP_" + status.value());
            return diagnostic(problem);
        }
        // Framework 4xx responses must retain their actual HTTP status.
        if (exception instanceof ErrorResponse response && response.getStatusCode().is4xxClientError()) {
            var problem = response.getBody();
            problem.setProperty("code", "HTTP_" + response.getStatusCode().value());
            return diagnostic(problem);
        }
        LOG.error("Unhandled request failure method={} path={}", request.getMethod(), request.getRequestURI(), exception);
        var status = exception instanceof ErrorResponse response ? response.getStatusCode() : HttpStatus.INTERNAL_SERVER_ERROR;
        var problem = ProblemDetail.forStatusAndDetail(status,
            "服务器处理请求时发生异常，请管理员凭请求标识查询服务日志。");
        problem.setTitle("服务器异常");
        problem.setType(URI.create("urn:bookkin:error:internal_error"));
        problem.setProperty("code", status.value() == 500 ? "INTERNAL_ERROR" : "HTTP_" + status.value());
        return diagnostic(problem);
    }
}
