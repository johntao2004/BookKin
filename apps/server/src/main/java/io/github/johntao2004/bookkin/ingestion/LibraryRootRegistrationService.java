package io.github.johntao2004.bookkin.ingestion;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Profile;
import org.springframework.transaction.annotation.Transactional;
import io.github.johntao2004.bookkin.filemanagement.infrastructure.LibraryLocationProbe;
@Service
@Profile("api")
public class LibraryRootRegistrationService {
    private final LibraryRootRepository roots;
    private final LibraryLocationProbe probe;
    private final LibraryRootCapabilityService capabilities;
    public LibraryRootRegistrationService(LibraryRootRepository roots, LibraryLocationProbe probe, LibraryRootCapabilityService capabilities) { this.roots = roots; this.probe = probe; this.capabilities = capabilities; }
    public LibraryLocationProbe.Result preview(String path) { var result = probe.inspect(path); checkOverlap(result.path()); return result; }
    private void checkOverlap(String path) {
        Path candidate = Path.of(path);
        for (var root : roots.findAll()) {
            Path existing = Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath()).normalize();
            if (candidate.startsWith(existing) || existing.startsWith(candidate)) throw new IllegalArgumentException("该位置已是书库，或与现有书库目录重叠");
        }
    }
    @Transactional
    public LibraryRoot create(String name, String path, String fingerprint, UUID key) {
        if (name == null || name.isBlank() || name.length() > 100 || key == null) throw new IllegalArgumentException("请填写有效名称");
        roots.lockRegistration();
        var previous = roots.findById(key);
        if (previous.isPresent()) {
            if (!previous.get().configuredPath().equals(path) || !previous.get().name().equals(name.trim())) throw new IllegalArgumentException("该请求标识已用于其他书库");
            return previous.get();
        }
        var result = preview(path);
        if (!result.fingerprint().equals(fingerprint)) throw new IllegalArgumentException("目录已变化，请重新检查位置");
        if (roots.findByName(name.trim()).isPresent()) throw new IllegalArgumentException("书库名称已存在");
        var root = roots.insert(key, name.trim(), result.path());
        capabilities.check(root);
        return roots.findById(key).orElseThrow();
    }
}
