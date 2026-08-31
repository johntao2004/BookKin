package io.github.johntao2004.bookkin.users;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class UserRepository {
    private final DSLContext dsl;

    public UserRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public long count() {
        return dsl.fetchCount(dsl.selectFrom("app_users"));
    }

    public Optional<BookKinUser> findByUsername(String username) {
        return dsl.fetchOptional("select * from app_users where lower(username) = lower(?)", username).map(this::map);
    }

    public Optional<BookKinUser> findById(UUID id) {
        return dsl.fetchOptional("select * from app_users where id = ?", id).map(this::map);
    }

    public Optional<BookKinUser> findOwner() {
        return dsl.fetchOptional("select * from app_users where role = 'OWNER' order by created_at limit 1").map(this::map);
    }

    public List<BookKinUser> findAll() {
        return dsl.fetch("select * from app_users order by case role when 'OWNER' then 0 when 'ADMIN' then 1 else 2 end, created_at")
                .map(this::map);
    }

    @Transactional
    public BookKinUser create(String username, String displayName, String hash, UserRole role, boolean mustChangePassword) {
        UUID id = UUID.randomUUID();
        dsl.execute("""
                insert into app_users(id, username, display_name, password_hash, role, must_change_password)
                values (?, ?, ?, ?, ?, ?)
                """, id, username.toLowerCase(Locale.ROOT), displayName, hash, role.name(), mustChangePassword);
        return findById(id).orElseThrow();
    }

    @Transactional
    public Optional<BookKinUser> createOwnerIfEmpty(String username, String displayName, String hash) {
        dsl.execute("select pg_advisory_xact_lock(hashtext('bookkin-owner-initialization'))");
        if (count() > 0) return Optional.empty();
        return Optional.of(create(username, displayName, hash, UserRole.OWNER, false));
    }

    public void recordLogin(UUID id) {
        dsl.execute("update app_users set last_login_at = now(), updated_at = now() where id = ?", id);
    }

    public void updatePassword(UUID id, String hash) {
        dsl.execute("""
                update app_users set password_hash = ?, must_change_password = false,
                  password_changed_at = now(), updated_at = now() where id = ?
                """, hash, id);
    }

    @Transactional
    public BookKinUser setTemporaryPassword(UUID id, String hash) {
        var user = findById(id).orElseThrow();
        dsl.execute("""
                update app_users set password_hash = ?, must_change_password = true,
                  password_changed_at = now(), updated_at = now() where id = ?
                """, hash, id);
        dsl.execute("delete from spring_session where principal_name = ?", user.username());
        return findById(id).orElseThrow();
    }

    public void revokeSessions(UUID id) {
        var user = findById(id).orElseThrow();
        dsl.execute("delete from spring_session where principal_name = ?", user.username());
    }

    @Transactional
    public BookKinUser toggleStatus(UUID id) {
        var current = findById(id).orElseThrow();
        var next = current.status() == UserStatus.ACTIVE ? UserStatus.DISABLED : UserStatus.ACTIVE;
        dsl.execute("update app_users set status = ?, updated_at = now() where id = ?", next.name(), id);
        if (next == UserStatus.DISABLED) {
            dsl.execute("delete from spring_session where principal_name = ?", current.username());
        }
        return findById(id).orElseThrow();
    }

    private BookKinUser map(Record record) {
        return new BookKinUser(
                record.get("id", UUID.class),
                record.get("username", String.class),
                record.get("display_name", String.class),
                record.get("password_hash", String.class),
                UserRole.valueOf(record.get("role", String.class)),
                UserStatus.valueOf(record.get("status", String.class)),
                Boolean.TRUE.equals(record.get("must_change_password", Boolean.class)),
                record.get("created_at", OffsetDateTime.class),
                record.get("last_login_at", OffsetDateTime.class));
    }
}
