package com.elexvx.bookkin.filemanagement;

import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.FileOperationModels.ExecuteRequest;
import com.elexvx.bookkin.filemanagement.FileOperationModels.Operation;
import com.elexvx.bookkin.filemanagement.FileOperationModels.Preview;
import com.elexvx.bookkin.filemanagement.FileOperationModels.PreviewRequest;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/file-operations")
@PreAuthorize("hasAnyRole('OWNER','ADMIN')")
// 管理角色的预览与入队接口；返回任务记录不代表后台文件操作已完成。
// Management endpoints for preview and enqueueing; a returned job record does not mean filesystem work has finished.
public class FileOperationController {
    private final FileOperationService service;
    private final FileOperationRepository operations;

    public FileOperationController(FileOperationService service, FileOperationRepository operations) {
        this.service = service;
        this.operations = operations;
    }

    @PostMapping("/preview")
    Preview preview(@Valid @RequestBody PreviewRequest request, Principal principal) {
        return service.preview(request, principal);
    }

    @PostMapping
    Operation execute(@Valid @RequestBody ExecuteRequest request,
                      @RequestHeader("Idempotency-Key") String idempotencyKey,
                      Principal principal) {
        return service.execute(request, idempotencyKey, principal);
    }

    @GetMapping("/{id}")
    Operation get(@PathVariable UUID id) {
        return operations.find(id).orElseThrow(() -> ApiException.notFound("OPERATION_NOT_FOUND", "文件任务不存在。"));
    }

    @GetMapping
    OperationList list(@RequestParam(defaultValue = "50") String limit,
                       @RequestParam(required = false) String page,
                       @RequestParam(defaultValue = "10") String pageSize) {
        // Parse protocol input here so malformed/overflowing values use the same explicit 400 response.
        int size = pageParameter(pageSize, 1, 100);
        int recentLimit = pageParameter(limit, 1, 200);
        Integer current = page == null ? null : pageParameter(page, 0, Integer.MAX_VALUE);
        return new OperationList(current == null ? operations.list(recentLimit) : operations.page(current, size), operations.count());
    }

    private int pageParameter(String value, int minimum, int maximum) {
        try {
            int parsed = Integer.parseInt(value);
            if (parsed >= minimum && parsed <= maximum) return parsed;
        } catch (NumberFormatException ignored) { /* All invalid protocol values share the same response. */ }
        throw ApiException.badRequest("INVALID_PAGE", "分页参数无效，请使用有效页码和每页 1–100 条。");
    }

    public record OperationList(List<Operation> items, long total) {}
}
