package com.elexvx.bookkin.ingestion;

import com.elexvx.bookkin.config.BookKinProperties;
import com.elexvx.bookkin.filemanagement.infrastructure.PrivateContentStore;
import com.elexvx.bookkin.filemanagement.ContentStorageService;
import java.nio.file.*;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Validate configured and persisted book roots before creating application-owned content areas. */
@Component
@Profile({"api", "worker"})
public class ContentStorageInitializer implements ApplicationRunner {
    private final PrivateContentStore content;
    private final LibraryRootRepository roots;
    private final BookKinProperties properties;
    private final ContentStorageService scans;
    public ContentStorageInitializer(PrivateContentStore content, LibraryRootRepository roots, BookKinProperties properties, ContentStorageService scans) {
        this.content = content; this.roots = roots; this.properties = properties; this.scans = scans;
    }
    @Override public void run(ApplicationArguments args) throws Exception {
        for (var root : properties.storage().roots()) validate(root.path());
        for (var root : roots.findAll()) validate(root.configuredPath());
        content.initialize();
        scans.scanAll();
    }
    private void validate(String configured) throws Exception {
        Path path = Path.of(configured).toAbsolutePath().normalize();
        if (content.overlaps(path) || (Files.exists(path) && content.overlaps(path.toRealPath())))
            throw new IllegalArgumentException("书籍书库不能与文章书库或禁书区目录重叠，请检查存储配置");
    }
}
