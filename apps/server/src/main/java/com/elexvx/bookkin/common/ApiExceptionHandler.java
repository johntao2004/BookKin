package com.elexvx.bookkin.common;

import jakarta.validation.ConstraintViolationException;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
// 业务异常与参数校验异常转为 ProblemDetail，保持响应中的可识别错误码。
// Maps business and validation exceptions to ProblemDetail responses with identifiable error codes.
public class ApiExceptionHandler {
    @ExceptionHandler(ApiException.class)
    ProblemDetail apiException(ApiException exception) {
        var problem = ProblemDetail.forStatusAndDetail(exception.status(), exception.getMessage());
        problem.setTitle("请求无法完成");
        problem.setType(URI.create("urn:bookkin:error:" + exception.code().toLowerCase()));
        problem.setProperty("code", exception.code());
        return problem;
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, ConstraintViolationException.class})
    ProblemDetail validation(Exception exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "请求字段不符合约束，请检查后重试。");
        problem.setTitle("参数校验失败");
        problem.setProperty("code", "VALIDATION_FAILED");
        return problem;
    }
}
