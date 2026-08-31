package io.github.johntao2004.bookkin.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("bookkin")
public record BookKinProperties(
        String publicBaseUrl,
        Duration fileOperationPreviewTtl,
        Duration fileLeaseTimeout,
        Retention retention,
        Scan scan,
        Storage storage,
        Worker worker,
        Upload upload,
        Fonts fonts,
        MetadataProviders metadataProviders) {

    public BookKinProperties {
        fileOperationPreviewTtl = fileOperationPreviewTtl == null ? Duration.ofMinutes(5) : fileOperationPreviewTtl;
        fileLeaseTimeout = fileLeaseTimeout == null ? Duration.ofSeconds(30) : fileLeaseTimeout;
        retention = retention == null ? new Retention(Duration.ofDays(30), Duration.ofDays(30)) : retention;
        scan = scan == null ? new Scan(500, Duration.ofMinutes(5)) : scan;
        storage = storage == null ? new Storage(List.of()) : storage;
        worker = worker == null ? new Worker(Duration.ofSeconds(1)) : worker;
        upload = upload == null ? new Upload(2L * 1024 * 1024 * 1024, 20, Duration.ofHours(24), 20L * 1024 * 1024) : upload;
        fonts = fonts == null ? new Fonts("/var/lib/bookkin/fonts", 25L * 1024 * 1024) : fonts;
        metadataProviders = metadataProviders == null ? new MetadataProviders(true, null) : metadataProviders;
    }

    public record Retention(Duration recycleBin, Duration fileVersions) {}
    public record Scan(int batchSize, Duration interval) {}
    public record Storage(List<ConfiguredRoot> roots) {
        public Storage { roots = roots == null ? List.of() : List.copyOf(roots); }
    }
    public record ConfiguredRoot(String name, String path) {}
    public record Worker(Duration pollDelay) {}
    public record Upload(long maxFileSize, int maxBatchFiles, Duration retention, long maxCoverSize) {}
    public record Fonts(String storagePath, long maxFileSize) {}
    public record MetadataProviders(boolean openLibraryEnabled, String googleApiKey) {}
}
