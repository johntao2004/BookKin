package com.elexvx.bookkin.ingestion.upload;

import com.elexvx.bookkin.auth.RolePermissionService;
import com.elexvx.bookkin.catalog.BookRepository;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.config.BookKinProperties;
import java.security.Principal;
import org.springframework.stereotype.Service;

/** Advisory only: the receive/commit paths independently hash and claim the actual content. */
@Service
public class UploadPrecheckService {
    public enum Match { NONE, CATALOG, DRAFT }
    private final BookUploadRepository uploads;
    private final BookRepository books;
    private final RolePermissionService permissions;
    private final BookKinProperties properties;

    public UploadPrecheckService(BookUploadRepository uploads, BookRepository books,
                                 RolePermissionService permissions, BookKinProperties properties) {
        this.uploads = uploads;
        this.books = books;
        this.permissions = permissions;
        this.properties = properties;
    }

    public Match check(String fingerprint, long sizeBytes, Principal principal) {
        permissions.require(principal, "library.upload");
        var actor = permissions.actor(principal);
        if (!actor.canManageFiles()) throw ApiException.forbidden("ACCESS_DENIED", "无权上传书籍。");
        if (fingerprint == null || !fingerprint.matches("sha256:[0-9a-f]{64}")
                || sizeBytes <= 0 || sizeBytes > properties.upload().maxFileSize()) {
            throw ApiException.badRequest("INVALID_UPLOAD_PRECHECK", "文件指纹或大小无效。");
        }
        // The regular catalog is shared by library.view users. Never probe vault or unavailable files.
        if (permissions.snapshot(principal).grants().contains("library.view")
                && books.hasAvailableFingerprint(fingerprint, sizeBytes)) return Match.CATALOG;
        if (uploads.hasOwnedPendingFingerprint(actor.id(), fingerprint, sizeBytes)) return Match.DRAFT;
        return Match.NONE;
    }
}
