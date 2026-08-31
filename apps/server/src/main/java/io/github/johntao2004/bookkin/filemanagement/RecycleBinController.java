package io.github.johntao2004.bookkin.filemanagement;

import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.ExecuteRequest;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.Operation;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/recycle-bin")
@PreAuthorize("hasAnyRole('OWNER','ADMIN')")
public class RecycleBinController {
    private final RecycleBinRepository recycleBin;
    private final FileOperationService fileOperations;

    public RecycleBinController(RecycleBinRepository recycleBin, FileOperationService fileOperations) {
        this.recycleBin = recycleBin;
        this.fileOperations = fileOperations;
    }

    @GetMapping
    RecycleList list() {
        return new RecycleList(recycleBin.listActive());
    }

    @PostMapping("/{id}/restore")
    Operation restore(@PathVariable UUID id, @Valid @RequestBody ExecuteRequest input,
                      @RequestHeader("Idempotency-Key") String idempotencyKey, Principal principal) {
        return fileOperations.executeForRecycleEntry(id, FileOperationType.RESTORE, input, idempotencyKey, principal);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    Operation purge(@PathVariable UUID id, @Valid @RequestBody ExecuteRequest input,
                    @RequestHeader("Idempotency-Key") String idempotencyKey, Principal principal) {
        return fileOperations.executeForRecycleEntry(id, FileOperationType.PURGE, input, idempotencyKey, principal);
    }

    public record RecycleList(List<RecycleBinRepository.RecycleView> items) {}
}
