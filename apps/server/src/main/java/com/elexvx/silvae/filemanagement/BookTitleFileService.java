package com.elexvx.silvae.filemanagement;

import com.elexvx.silvae.catalog.BookFileStatus;
import com.elexvx.silvae.catalog.BookRepository;
import com.elexvx.silvae.common.ApiException;
import com.elexvx.silvae.filemanagement.FileOperationModels.ExecuteRequest;
import java.security.Principal;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Keeps physical names and bibliography in the caller's metadata transaction. */
@Service
public class BookTitleFileService {
    private final BookRepository books;
    private final FileOperationService files;
    private final FileOperationRepository operations;
    private final FileTransactionExecutor executor;
    private final PathPolicy paths;

    public BookTitleFileService(BookRepository books, FileOperationService files, FileOperationRepository operations,
                               FileTransactionExecutor executor, PathPolicy paths) {
        this.books = books; this.files = files; this.operations = operations; this.executor = executor; this.paths = paths;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void synchronize(UUID bookId, String title, Principal principal) {
        for (var file : books.findActiveFiles(bookId)) {
            String target = BookTitleFilename.inDirectory(file.relativePath(), title, file.format(), paths);
            if (target.equals(file.relativePath())) continue;
            if (file.status() != BookFileStatus.AVAILABLE) {
                throw ApiException.conflict("BOOK_FILE_UNAVAILABLE", "书籍文件当前不可用，无法同步书名，请稍后重试。");
            }
            // Reuse the permission, fingerprint, root, collision and idempotency checks of explicit file operations.
            String filename = target.substring(target.lastIndexOf('/') + 1);
            // The rename API expects a stem; titles ending in .pdf/.epub are literal title text here.
            String stem = filename.substring(0, filename.length() - file.format().name().length() - 1);
            var preview = files.previewTitleRename(file, stem, principal);
            if (!preview.conflicts().isEmpty()) {
                var conflict = preview.conflicts().getFirst();
                throw ApiException.conflict(conflict.code(), "文件名同步失败：" + conflict.message());
            }
            var operation = files.execute(new ExecuteRequest(preview.previewToken(), preview.expectedFingerprint()),
                    "title-sync-" + UUID.randomUUID(), principal);
            var execution = operations.claim(operation.id()).orElseThrow(() ->
                    ApiException.conflict("BOOK_FILE_BUSY", "书籍文件已有操作正在进行，请稍后重试。"));
            executor.execute(execution);
            var result = operations.find(operation.id()).orElseThrow();
            if (result.status() != FileOperationStatus.SUCCEEDED) {
                throw ApiException.conflict(result.errorCode() == null ? "TITLE_SYNC_FAILED" : result.errorCode(),
                        "文件名同步失败，书目信息未保存：" + result.errorDetail());
            }
        }
    }
}
