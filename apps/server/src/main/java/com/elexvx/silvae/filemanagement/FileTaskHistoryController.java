package com.elexvx.silvae.filemanagement;

import com.elexvx.silvae.common.ApiException;
import com.elexvx.silvae.filemanagement.FileTaskHistoryModels.Page;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/file-task-history")
@PreAuthorize("hasAnyRole('OWNER','ADMIN')")
public class FileTaskHistoryController {
    private final FileTaskHistoryService history;

    public FileTaskHistoryController(FileTaskHistoryService history) {
        this.history = history;
    }

    @GetMapping
    Page list(@RequestParam(defaultValue = "0") String page,
                         @RequestParam(defaultValue = "10") String pageSize) {
        int current = parameter(page, 0, Integer.MAX_VALUE);
        int size = parameter(pageSize, 1, 100);
        return history.page(current, size);
    }

    private static int parameter(String raw, int min, int max) {
        try {
            int value = Integer.parseInt(raw);
            if (value >= min && value <= max) return value;
        } catch (NumberFormatException ignored) { /* converted to protocol error */ }
        throw ApiException.badRequest("INVALID_PAGE", "分页参数无效，请使用有效页码和每页 1–100 条。");
    }
}
