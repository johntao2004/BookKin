package com.elexvx.bookkin.filemanagement;

import com.elexvx.bookkin.filemanagement.infrastructure.PrivateContentStore;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import org.jooq.DSLContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** Public storage-management gateway. Responses contain no filesystem paths or user content. */
@Service
public class ContentStorageService {
    private static final Logger log = LoggerFactory.getLogger(ContentStorageService.class);
    private final PrivateContentStore files;
    private final DSLContext db;
    public ContentStorageService(PrivateContentStore files, DSLContext db) { this.files = files; this.db = db; }

    public List<Snapshot> snapshots() {
        return files.locations().stream().map(area -> {
            var row = db.fetchOne("select last_scan_at from content_storage_scans where kind=? and path_hash=?", area.kind(), pathHash(area.configuredPath()));
            return new Snapshot(area.kind(), area.canRead(), area.canWrite(), area.freeBytes(), row == null ? null : row.get("last_scan_at", OffsetDateTime.class));
        }).toList();
    }

    public boolean scanAll() {
        boolean completed = true;
        for (var area : files.locations()) {
            try { files.scan(area.kind()); }
            catch (java.io.IOException failure) {
                log.warn("Content directory scan failed for {}", area.kind());
                completed = false;
                continue; // Retain the previous successful timestamp, never substitute the current time.
            }
            var completedAt = OffsetDateTime.now(ZoneOffset.UTC);
            db.execute("""
                insert into content_storage_scans(kind,path_hash,last_scan_at) values (?,?,?::timestamptz)
                on conflict(kind) do update set path_hash=excluded.path_hash,last_scan_at=excluded.last_scan_at
                where content_storage_scans.last_scan_at <= excluded.last_scan_at
                """, area.kind(), pathHash(area.configuredPath()), completedAt);
        }
        return completed;
    }
    private static String pathHash(String path) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(path.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    public record Snapshot(String kind, boolean canRead, boolean canWrite, Long freeBytes, OffsetDateTime lastScanAt) {}
}
