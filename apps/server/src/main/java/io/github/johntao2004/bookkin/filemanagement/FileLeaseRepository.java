package io.github.johntao2004.bookkin.filemanagement;

import io.github.johntao2004.bookkin.common.ApiException;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class FileLeaseRepository {
    private final DSLContext dsl;

    public FileLeaseRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public boolean hasActiveReadLease(UUID bookFileId) {
        dsl.execute("delete from file_leases where expires_at <= now()");
        return exists("select exists(select 1 from file_leases where book_file_id = ? and lease_type = 'READ' and expires_at > now())", bookFileId);
    }

    @Transactional
    public Lease acquireRead(UUID bookFileId, String holder, Duration ttl) {
        lock(bookFileId);
        dsl.execute("delete from file_leases where expires_at <= now()");
        if (exists("select exists(select 1 from file_leases where book_file_id = ? and lease_type = 'WRITE' and expires_at > now())", bookFileId)) {
            throw ApiException.conflict("FILE_OPERATING", "文件正在执行写操作，请稍后再阅读。");
        }
        UUID id = UUID.randomUUID();
        dsl.execute("""
                insert into file_leases(id, book_file_id, holder_id, lease_type, expires_at)
                values (?, ?, ?, 'READ', now() + (? * interval '1 millisecond'))
                on conflict (book_file_id, holder_id) do update set expires_at = excluded.expires_at
                """, id, bookFileId, holder, ttl.toMillis());
        return new Lease(bookFileId, holder);
    }

    @Transactional
    public Optional<Lease> tryAcquireWrite(UUID bookFileId, String holder, Duration ttl) {
        lock(bookFileId);
        dsl.execute("delete from file_leases where expires_at <= now()");
        if (exists("select exists(select 1 from file_leases where book_file_id = ? and expires_at > now())", bookFileId)) {
            return Optional.empty();
        }
        UUID id = UUID.randomUUID();
        dsl.execute("""
                insert into file_leases(id, book_file_id, holder_id, lease_type, expires_at)
                values (?, ?, ?, 'WRITE', now() + (? * interval '1 millisecond'))
                """, id, bookFileId, holder, ttl.toMillis());
        return Optional.of(new Lease(bookFileId, holder));
    }

    public void release(Lease lease) {
        dsl.execute("delete from file_leases where book_file_id = ? and holder_id = ?", lease.bookFileId(), lease.holder());
    }

    private void lock(UUID bookFileId) {
        dsl.execute("select pg_advisory_xact_lock(hashtextextended(?::text, 0))", bookFileId.toString());
    }

    private boolean exists(String sql, UUID bookFileId) {
        var record = dsl.fetchOne(sql, bookFileId);
        return record != null && Boolean.TRUE.equals(record.get(0, Boolean.class));
    }

    public record Lease(UUID bookFileId, String holder) {}
}
