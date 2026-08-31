package io.github.johntao2004.bookkin.filemanagement;

import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.ExecuteRequest;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.Operation;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.Preview;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.PreviewRequest;
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
    OperationList list(@RequestParam(defaultValue = "50") int limit) {
        return new OperationList(operations.list(limit));
    }

    public record OperationList(List<Operation> items) {}
}
