package io.github.johntao2004.bookkin.ingestion;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

@Repository
public class LibraryRootRepository {
    private final DSLContext dsl;

    public LibraryRootRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public void lockRegistration() { dsl.execute("lock table library_roots in exclusive mode"); }
    public LibraryRoot insert(UUID id, String name, String path) {
        dsl.execute("insert into library_roots(id, name, configured_path) values (?, ?, ?)", id, name, path);
        return findById(id).orElseThrow();
    }
    public List<LibraryRoot> findAll() {
        return dsl.fetch("select * from library_roots order by name").map(this::map);
    }

    public Optional<LibraryRoot> findById(UUID id) {
        return dsl.fetchOptional("select * from library_roots where id = ?", id).map(this::map);
    }

    public Optional<LibraryRoot> findByName(String name) {
        return dsl.fetchOptional("select * from library_roots where lower(name) = lower(?)", name).map(this::map);
    }

    public LibraryRoot upsertConfigured(String name, String path) {
        dsl.execute("""
                insert into library_roots(name, configured_path) values (?, ?)
                on conflict (configured_path) do update set name = excluded.name, updated_at = now()
                """, name, path);
        return dsl.fetchOptional("select * from library_roots where configured_path = ?", path).map(this::map).orElseThrow();
    }

    public void updateCapabilities(UUID id, String canonicalPath, LibraryRoot.RootStatus status, boolean canRead,
                                   boolean canWrite, boolean canAtomicMove, boolean canStage, Long freeBytes) {
        dsl.execute("""
                update library_roots set canonical_path = ?, status = ?, can_read = ?, can_write = ?, can_atomic_move = ?,
                  can_stage = ?, free_bytes = ?, last_capability_check_at = now(), updated_at = now() where id = ?
                """, canonicalPath, status.name(), canRead, canWrite, canAtomicMove, canStage, freeBytes, id);
    }

    public void recordScan(UUID id) {
        dsl.execute("update library_roots set last_scan_at = now(), updated_at = now() where id = ?", id);
    }

    private LibraryRoot map(Record record) {
        return new LibraryRoot(record.get("id", UUID.class), record.get("name", String.class),
                record.get("configured_path", String.class), record.get("canonical_path", String.class),
                LibraryRoot.RootStatus.valueOf(record.get("status", String.class)),
                Boolean.TRUE.equals(record.get("can_read", Boolean.class)), Boolean.TRUE.equals(record.get("can_write", Boolean.class)),
                Boolean.TRUE.equals(record.get("can_atomic_move", Boolean.class)), Boolean.TRUE.equals(record.get("can_stage", Boolean.class)),
                record.get("free_bytes", Long.class), record.get("last_capability_check_at", OffsetDateTime.class),
                record.get("last_scan_at", OffsetDateTime.class));
    }
}
