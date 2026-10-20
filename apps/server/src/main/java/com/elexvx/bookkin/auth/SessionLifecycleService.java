package com.elexvx.bookkin.auth;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.UserRepository;
import com.elexvx.bookkin.users.UserRole;
import jakarta.servlet.http.HttpSession;
import java.time.Instant;
import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionLifecycleService {
    private final DSLContext db;
    private final UserRepository users;
    private final AuditService audit;
    public SessionLifecycleService(DSLContext db, UserRepository users, AuditService audit) {
        this.db=db; this.users=users; this.audit=audit;
    }
    public int maxMinutes() {
        return db.fetchOne("select session_max_minutes from security_settings where id=1").get(0,Integer.class);
    }
    @Transactional
    public int savePolicy(String username, int minutes) {
        var actor=users.findByUsername(username).orElseThrow();
        if(actor.role()!=UserRole.OWNER) throw ApiException.forbidden("OWNER_REQUIRED","仅主人可修改会话时长。");
        if(minutes<5 || minutes>43200) throw ApiException.conflict("INVALID_SESSION_DURATION","会话时长需为 5–43200 分钟。");
        db.execute("update security_settings set session_max_minutes=?,updated_at=now() where id=1",minutes);
        audit.record(actor.id(),"SESSION_POLICY_CHANGED","SECURITY","sessions",null,null,null,null,"SUCCEEDED","{}");
        return minutes;
    }
    public Status status(HttpSession session) {
        long expiresAt=session.getCreationTime()+maxMinutes()*60_000L;
        var pending=db.fetchOne("select r.revoke_at from session_revocation r join spring_session s on s.primary_id=r.session_primary_id where s.session_id=?",session.getId());
        if(pending!=null) expiresAt=Math.min(expiresAt,pending.get(0,Long.class));
        return new Status(expiresAt, pending!=null, System.currentTimeMillis());
    }
    public List<ActiveSession> active(String currentId) {
        long now=System.currentTimeMillis(); long maxAge=maxMinutes()*60_000L;
        return db.fetch("select s.*,r.revoke_at from spring_session s left join session_revocation r on r.session_primary_id=s.primary_id where s.principal_name is not null and s.expiry_time>? and s.creation_time+?>? and (r.revoke_at is null or r.revoke_at>?) order by s.last_access_time desc",now,maxAge,now,now).stream().map(r -> {
            var user=users.findByUsername(r.get("principal_name",String.class)).orElse(null);
            long expires=Math.min(r.get("expiry_time",Long.class),r.get("creation_time",Long.class)+maxAge);
            Long revoke=r.get("revoke_at",Long.class);
            if(revoke!=null) expires=Math.min(expires,revoke);
            return user==null?null:new ActiveSession(r.get("primary_id",String.class).trim(),user.id().toString(),user.username(),user.displayName(),user.role().name(),Instant.ofEpochMilli(r.get("creation_time",Long.class)),Instant.ofEpochMilli(r.get("last_access_time",Long.class)),Instant.ofEpochMilli(expires),r.get("session_id",String.class).trim().equals(currentId),revoke!=null);
        }).filter(java.util.Objects::nonNull).toList();
    }
    // Existing sessions get a short save window; a later login is never revoked.
    @Transactional
    public void requestRevocation(String username) {
        db.execute("insert into session_revocation(session_primary_id,revoke_at) select primary_id,? from spring_session where principal_name=? on conflict(session_primary_id) do nothing",System.currentTimeMillis()+30_000,username);
    }
    public record Status(long expiresAt,boolean revocationRequested,long serverTime) {}
    public record ActiveSession(String id,String userId,String username,String displayName,String role,Instant createdAt,Instant lastAccessAt,Instant expiresAt,boolean current,boolean ending) {}
}
