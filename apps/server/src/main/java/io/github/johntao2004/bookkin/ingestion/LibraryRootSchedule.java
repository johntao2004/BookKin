package io.github.johntao2004.bookkin.ingestion;
import io.github.johntao2004.bookkin.config.BookKinProperties;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
@Component
@Profile("worker")
public class LibraryRootSchedule implements ApplicationRunner {
    private final LibraryRootRepository roots;
    private final BookKinProperties properties;
    private final LibraryRootCapabilityService capabilities;
    public LibraryRootSchedule(LibraryRootRepository roots, BookKinProperties properties, LibraryRootCapabilityService capabilities) {
        this.roots = roots; this.properties = properties; this.capabilities = capabilities;
    }
    public void run(ApplicationArguments args) {
        for (var root : properties.storage().roots()) roots.upsertConfigured(root.name(), root.path());
        capabilities.checkAll();
    }
    @Scheduled(fixedDelayString = "1m", initialDelayString = "30s")
    public void checkAll() { capabilities.checkAll(); }
}
