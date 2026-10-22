package com.elexvx.bookkin.ingestion;

import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.infrastructure.LibraryLocationProbe;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

// 当前仅使用部署配置的默认书库。旧登记接口明确拒绝，不探测或写入用户目录。
@Service
@Profile("api")
public class LibraryRootRegistrationService {
    public LibraryLocationProbe.Result preview(String path) {
        throw disabled();
    }

    public LibraryRoot create(String name, String path, String fingerprint, UUID key) {
        throw disabled();
    }

    private ApiException disabled() {
        return ApiException.forbidden("LIBRARY_ROOT_REGISTRATION_DISABLED", "当前仅使用默认书库，暂不支持新增书库。");
    }
}
