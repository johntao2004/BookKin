package com.elexvx.bookkin.auth;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.*;
import jakarta.servlet.http.HttpSession;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Public auth gateway for the vault. Grants are session-, user-, policy- and credential-bound. */
@Service
@org.springframework.context.annotation.Profile("api")
public class TwoFactorService {
    private static final String GRANT="bookkin.vault.twoFactor";
    private final DSLContext db;
    private final UserRepository users;
    private final RolePermissionService permissions;
    private final PasswordEncoder passwords;
    private final TwoFactorCrypto crypto;
    private final AuditService audit;
    private final Clock clock;
    public record Policy(boolean enabled, boolean configured, long revision) {}
    public record Status(boolean enabled, boolean configured, boolean bound, boolean verified, long expiresAt) {}
    public record Enrollment(String id, String secret, String uri, long expiresAt) {}
    public record Bound(List<String> recoveryCodes) {}
    @Autowired public TwoFactorService(DSLContext db, UserRepository users, RolePermissionService permissions, PasswordEncoder passwords, TwoFactorCrypto crypto, AuditService audit) {
        this(db,users,permissions,passwords,crypto,audit,Clock.systemUTC());
    }
    TwoFactorService(DSLContext db, UserRepository users, RolePermissionService permissions, PasswordEncoder passwords, TwoFactorCrypto crypto, AuditService audit, Clock clock) {
        this.db=db;this.users=users;this.permissions=permissions;this.passwords=passwords;this.crypto=crypto;this.audit=audit;this.clock=clock;
    }
    public Policy policy() {
        var row=db.fetchOne("select enabled,revision from vault_policy where id=1");
        return new Policy(row.get("enabled",Boolean.class),crypto.configured(),row.get("revision",Long.class));
    }
    @Transactional public Policy savePolicy(boolean enabled, long revision, Principal principal) {
        var actor=permissions.actor(principal);
        if(actor.role()!=UserRole.OWNER) throw ApiException.forbidden("OWNER_REQUIRED","仅主人可配置禁书区。");
        if(enabled && !crypto.configured()) throw ApiException.conflict("TWO_FACTOR_UNCONFIGURED","请先配置服务器身份验证器加密密钥。");
        if(db.execute("update vault_policy set enabled=?,revision=revision+1 where id=1 and revision=?",enabled,revision)!=1)
            throw ApiException.conflict("VAULT_POLICY_CONFLICT","禁书区设置已更新，请刷新后重试。");
        audit(actor.id(),"VAULT_POLICY_CHANGED","SUCCEEDED"); return policy();
    }
    private BookKinUser actor(Principal principal) { permissions.require(principal,"vault.use"); return permissions.actor(principal); }
    private Policy available() {
        var policy=policy();
        if(!policy.enabled()) throw ApiException.forbidden("VAULT_DISABLED","主人尚未启用禁书区。");
        if(!policy.configured()) throw ApiException.conflict("TWO_FACTOR_UNCONFIGURED","身份验证器服务尚未配置。");
        return policy;
    }
    public Status status(Principal principal, HttpSession session) {
        var actor=actor(principal); var policy=policy();
        var row=db.fetchOne("select secret_ciphertext is not null as bound,credential_version from two_factor_credentials where user_id=?",actor.id());
        boolean bound=row!=null && row.get("bound",Boolean.class); long expiry=0;
        if(session!=null && policy.enabled() && policy.configured() && bound) {
            Object raw=session.getAttribute(GRANT);
            if(raw instanceof String value) {
                var parts=value.split("\\|",-1);
                if(parts.length==4 && parts[0].equals(actor.id().toString()) && parts[1].equals(row.get("credential_version").toString()) && parts[2].equals(Long.toString(policy.revision()))) {
                    try { expiry=Long.parseLong(parts[3]); } catch(NumberFormatException ignored) { /* Invalid grants fail closed. */ }
                }
            }
        }
        boolean verified=expiry>clock.millis();
        if(!verified && session!=null) session.removeAttribute(GRANT);
        return new Status(policy.enabled(),policy.configured(),bound,verified,verified?expiry:0);
    }
    public void requireVaultAccess(Principal principal, HttpSession session) {
        var state=status(principal,session);
        if(!state.enabled()) throw ApiException.forbidden("VAULT_DISABLED","主人尚未启用禁书区。");
        if(!state.configured()) throw ApiException.conflict("TWO_FACTOR_UNCONFIGURED","身份验证器服务尚未配置。");
        if(!state.bound()) throw ApiException.forbidden("TWO_FACTOR_SETUP_REQUIRED","请先绑定身份验证器。");
        if(!state.verified()) throw ApiException.forbidden("TWO_FACTOR_REQUIRED","请验证身份验证器动态码后进入禁书区。");
    }
    public void lock(HttpSession session) { if(session!=null) session.removeAttribute(GRANT); }
    public Status renew(Principal principal, HttpSession session) {
        // A heartbeat can extend a verified visit, never create or resurrect one.
        requireVaultAccess(principal,session);
        Object value=session.getAttribute(GRANT);
        if(!(value instanceof String existing)) throw ApiException.forbidden("TWO_FACTOR_REQUIRED","请重新验证身份验证器动态码。");
        // Preserve the versions that were verified; racing a rebind/policy change must not upgrade a grant.
        session.setAttribute(GRANT,existing.substring(0,existing.lastIndexOf('|')+1)+(clock.millis()+300_000));
        return status(principal,session);
    }
    private Record lockCredential(UUID user) {
        db.execute("insert into two_factor_credentials(user_id,credential_version,attempt_window) values (?,?,?::timestamptz) on conflict do nothing",user,UUID.randomUUID(),OffsetDateTime.ofInstant(clock.instant(),ZoneOffset.UTC));
        return db.fetchOne("select * from two_factor_credentials where user_id=? for update",user);
    }
    private void consume(Record row, UUID user) {
        var now=OffsetDateTime.ofInstant(clock.instant(),ZoneOffset.UTC);
        boolean reset=row.get("attempt_window",OffsetDateTime.class).isBefore(now.minusMinutes(5));
        int attempts=reset?0:row.get("attempts",Integer.class);
        if(attempts>=8) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,"TWO_FACTOR_RATE_LIMITED","验证尝试过于频繁，请 5 分钟后再试。");
        db.execute("update two_factor_credentials set attempts=?,attempt_window=?::timestamptz where user_id=?",attempts+1,reset?now:row.get("attempt_window"),user);
    }
    private void password(BookKinUser actor,String password) {
        if(password==null || password.length()>256 || !passwords.matches(password,actor.passwordHash()))
            throw ApiException.badRequest("PASSWORD_INVALID","当前登录密码不正确。");
    }
    @Transactional(noRollbackFor=ApiException.class)
    public Enrollment begin(String password, Principal principal) {
        var actor=actor(principal); available(); var row=lockCredential(actor.id()); consume(row,actor.id()); password(actor,password);
        if(row.get("secret_ciphertext")!=null) throw ApiException.conflict("TWO_FACTOR_ALREADY_BOUND","已绑定身份验证器，请先验证或重新绑定。");
        String secret=Totp.newSecret(); UUID id=UUID.randomUUID(); var expires=clock.instant().plusSeconds(600);
        db.execute("update two_factor_credentials set pending_ciphertext=?,pending_id=?,pending_expires_at=?::timestamptz where user_id=?",crypto.encrypt(actor.id(),secret),id,OffsetDateTime.ofInstant(expires,ZoneOffset.UTC),actor.id());
        String label=URLEncoder.encode("BookKin:"+actor.username(),StandardCharsets.UTF_8).replace("+","%20");
        return new Enrollment(id.toString(),secret,"otpauth://totp/"+label+"?secret="+secret+"&issuer=BookKin&algorithm=SHA1&digits=6&period=30",expires.toEpochMilli());
    }
    @Transactional(noRollbackFor=ApiException.class)
    public Bound confirm(UUID enrollmentId, String code, Principal principal, HttpSession session) {
        var actor=actor(principal); var policy=available(); var row=lockCredential(actor.id()); consume(row,actor.id());
        if(row.get("secret_ciphertext")!=null || !Objects.equals(enrollmentId,row.get("pending_id")) || row.get("pending_ciphertext")==null || !row.get("pending_expires_at",OffsetDateTime.class).toInstant().isAfter(clock.instant()))
            throw ApiException.conflict("TWO_FACTOR_ENROLLMENT_EXPIRED","绑定已过期，请重新获取二维码。");
        long step=Totp.match(crypto.decrypt(actor.id(),row.get("pending_ciphertext",String.class)),code,clock.millis(),-1);
        if(step<0) { audit(actor.id(),"TWO_FACTOR_BIND","FAILED"); throw ApiException.badRequest("TWO_FACTOR_INVALID","动态码不正确或已过期。"); }
        UUID version=UUID.randomUUID();
        db.execute("update two_factor_credentials set secret_ciphertext=pending_ciphertext,pending_ciphertext=null,pending_id=null,pending_expires_at=null,credential_version=?,last_step=?,attempts=0 where user_id=?",version,step,actor.id());
        db.execute("delete from two_factor_recovery_codes where user_id=?",actor.id());
        List<String> codes=new ArrayList<>();
        for(int i=0;i<10;i++) {
            byte[] bytes=new byte[16]; new SecureRandom().nextBytes(bytes);
            String raw=HexFormat.of().withUpperCase().formatHex(bytes);
            String printable=String.join("-",raw.substring(0,8),raw.substring(8,16),raw.substring(16,24),raw.substring(24)); codes.add(printable);
            db.execute("insert into two_factor_recovery_codes(user_id,code_hash) values (?,?)",actor.id(),hash(actor.id(),raw));
        }
        grant(session,actor.id(),version,policy.revision()); audit(actor.id(),"TWO_FACTOR_BIND","SUCCEEDED");
        return new Bound(List.copyOf(codes));
    }
    @Transactional(noRollbackFor=ApiException.class)
    public Status verify(String code, boolean recovery, Principal principal, HttpSession session) {
        var actor=actor(principal); var policy=available(); var row=lockCredential(actor.id()); consume(row,actor.id());
        validate(row,actor.id(),code,recovery);
        grant(session,actor.id(),row.get("credential_version",UUID.class),policy.revision());
        audit(actor.id(),recovery?"TWO_FACTOR_RECOVERY":"TWO_FACTOR_VERIFY","SUCCEEDED"); return status(principal,session);
    }
    private void validate(Record row, UUID user, String code, boolean recovery) {
        if(row.get("secret_ciphertext")==null) throw ApiException.forbidden("TWO_FACTOR_SETUP_REQUIRED","请先绑定身份验证器。");
        boolean valid=false;
        if(recovery) {
            String normalized=code==null?"":code.replace("-","").strip().toUpperCase(Locale.ROOT);
            if(normalized.matches("[0-9A-F]{32}")) valid=db.execute("delete from two_factor_recovery_codes where user_id=? and code_hash=?",user,hash(user,normalized))==1;
        } else {
            long step=Totp.match(crypto.decrypt(user,row.get("secret_ciphertext",String.class)),code,clock.millis(),row.get("last_step",Long.class));
            if(step>=0) { db.execute("update two_factor_credentials set last_step=? where user_id=?",step,user); valid=true; }
        }
        if(!valid) { audit(user,"TWO_FACTOR_VERIFY","FAILED"); throw ApiException.badRequest("TWO_FACTOR_INVALID","验证码不正确、已过期或已使用。"); }
        db.execute("update two_factor_credentials set attempts=0 where user_id=?",user);
    }
    @Transactional(noRollbackFor=ApiException.class)
    public void reset(String password,String code,boolean recovery,Principal principal,HttpSession session) {
        var actor=actor(principal); available(); var row=lockCredential(actor.id()); consume(row,actor.id()); password(actor,password); validate(row,actor.id(),code,recovery);
        db.execute("update two_factor_credentials set secret_ciphertext=null,pending_ciphertext=null,pending_id=null,pending_expires_at=null,last_step=-1,credential_version=? where user_id=?",UUID.randomUUID(),actor.id());
        db.execute("delete from two_factor_recovery_codes where user_id=?",actor.id()); lock(session); audit(actor.id(),"TWO_FACTOR_RESET","SUCCEEDED");
    }
    private void grant(HttpSession session,UUID user,UUID version,long revision) {
        session.setAttribute(GRANT,user+"|"+version+"|"+revision+"|"+(clock.millis()+300_000));
    }
    private String hash(UUID user,String code) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((user+":"+code).getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private void audit(UUID user,String event,String outcome) { audit.record(user,event,"SECURITY","two-factor",null,null,null,null,outcome,"{}"); }
}
