package com.elexvx.bookkin.filemanagement.infrastructure;

import com.elexvx.bookkin.catalog.BookFile;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.FileFingerprints;
import com.elexvx.bookkin.filemanagement.FileLeaseRepository;
import com.elexvx.bookkin.filemanagement.PathPolicy;
import com.elexvx.bookkin.ingestion.LibraryRootRepository;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;
import org.springframework.stereotype.Service;

// 从受管文件提取有界只读知识文本的窄接口网关。
/** Narrow gateway for bounded read-only knowledge extraction from a managed file. */
@Service
public class KnowledgeTextGateway {
    private final LibraryRootRepository roots;
    private final FileLeaseRepository leases;
    private final PathPolicy paths;
    private final FileFingerprints fingerprints;
    private final BookTextSampler sampler;
    public KnowledgeTextGateway(LibraryRootRepository roots, FileLeaseRepository leases, PathPolicy paths,
                                FileFingerprints fingerprints, BookTextSampler sampler) {
        this.roots = roots; this.leases = leases; this.paths = paths; this.fingerprints = fingerprints; this.sampler = sampler;
    }
    public BookTextSampler.Sample sample(BookFile file) throws Exception {
        var lease = leases.acquireRead(file.id(), "knowledge:" + UUID.randomUUID(), Duration.ofMinutes(5));
        try {
            var root = roots.findById(file.libraryRootId()).orElseThrow();
            var path = paths.resolveExisting(Path.of(root.canonicalPath() == null ? root.configuredPath() : root.canonicalPath()), file.relativePath());
            if (!fingerprints.sha256(path).equals(file.fingerprint())) throw ApiException.conflict("KNOWLEDGE_SOURCE_CHANGED", "书籍文件已变化，请先重新扫描。");
            var sample = sampler.sample(path, file.format());
            if (!fingerprints.sha256(path).equals(file.fingerprint())) throw ApiException.conflict("KNOWLEDGE_SOURCE_CHANGED", "提取期间书籍文件发生变化，请重试。");
            return sample;
        } finally { leases.release(lease); }
    }
}
