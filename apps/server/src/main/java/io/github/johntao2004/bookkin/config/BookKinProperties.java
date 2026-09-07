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
        MetadataProviders metadataProviders,
        Ai ai) {

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
        ai = ai == null ? new Ai(false, true, 4, Duration.ofSeconds(20), List.of(), "") : ai;
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

    public record Ai(boolean enabled, boolean autoMatch, int maxCandidates, Duration timeout, List<AiProvider> providers,
                     String settingsEncryptionKey) {
        public Ai {
            maxCandidates = maxCandidates <= 0 ? 4 : Math.min(maxCandidates, 10);
            timeout = timeout == null ? Duration.ofSeconds(20) : timeout;
            providers = providers == null ? List.of() : List.copyOf(providers);
            settingsEncryptionKey = settingsEncryptionKey == null ? "" : settingsEncryptionKey.strip();
        }
    }

    public record AiProvider(String id, String label, AiProviderType type, boolean enabled,
                             String baseUrl, String apiKey, String model) {
        public AiProvider {
            id = id == null ? "" : id.strip();
            label = label == null || label.isBlank() ? id : label.strip();
            type = type == null ? AiProviderType.OPENAI_COMPATIBLE : type;
            baseUrl = baseUrl == null ? "" : baseUrl.strip();
            apiKey = apiKey == null ? "" : apiKey.strip();
            model = model == null ? "" : model.strip();
        }
    }

    public enum AiProviderType { OPENAI_COMPATIBLE, ANTHROPIC, GEMINI }
}
