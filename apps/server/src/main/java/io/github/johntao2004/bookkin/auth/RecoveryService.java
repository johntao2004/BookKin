package io.github.johntao2004.bookkin.auth;

import io.github.johntao2004.bookkin.users.*;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.audit.AuditService;
import java.security.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
@org.springframework.context.annotation.Profile("api")
public class RecoveryService {
    private final DSLContext db;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final MailService mail;
    private final AuditService audit;
    private final io.github.johntao2004.bookkin.auth.PasswordPolicyService passwordPolicy;
    public RecoveryService(DSLContext db, UserRepository users, PasswordEncoder passwords, MailService mail, AuditService audit, io.github.johntao2004.bookkin.auth.PasswordPolicyService passwordPolicy) {
        this.db=db; this.users=users; this.passwords=passwords; this.mail=mail; this.audit=audit; this.passwordPolicy=passwordPolicy;
    }
    public String email(UUID id) { return db.fetchOptional("select email from recovery_mailboxes where user_id=?",id).map(r->r.get(0,String.class)).orElse(""); }
    @Transactional
    public void bind(BookKinUser user, String email, String password) {
        if (!passwords.matches(password,user.passwordHash())) throw ApiException.badRequest("CURRENT_PASSWORD_INVALID","当前密码不正确。");
        issue(user, email.toLowerCase(Locale.ROOT).trim(), "BIND");
    }
    @Transactional
    public void request(String email) {
        if (!mail.settings().enabled()) throw ApiException.badRequest("MAIL_DISABLED","主人尚未启用邮件服务。");
        var id = db.fetchOptional("select user_id from recovery_mailboxes where email=?",email.toLowerCase(Locale.ROOT).trim()).map(r->r.get(0,UUID.class));
        id.flatMap(users::findById).filter(u->u.status()==UserStatus.ACTIVE).ifPresent(user -> {
            try { issue(user,email.toLowerCase(Locale.ROOT).trim(),"RESET"); }
            catch (ApiException e) { // Keep account existence private; owner can diagnose delivery with test mail.
                audit.record(user.id(),"PASSWORD_RESET_MAIL_FAILED","USER",user.id().toString(),null,null,null,null,"FAILED","{}");
            }
        });
    }
    private void issue(BookKinUser user, String email, String purpose) {
        // Serialize issuance/consumption per user without accessing another module's tables.
        db.execute("select pg_advisory_xact_lock(hashtext(?))","recovery:"+user.id());
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        db.execute("delete from recovery_tokens where expires_at<now() or (user_id=? and purpose=?)",user.id(),purpose);
        db.execute("insert into recovery_tokens values(?,?,?,?,?,now()+interval '30 minutes')",hash(token),user.id(),purpose,email,user.passwordHash());
        try { mail.send(email,purpose.equals("BIND")?"验证 BookKin 找回邮箱":"重置 BookKin 密码",
            "请在 30 分钟内打开以下链接：\n"+mail.settings().publicUrl()+"/recover#"+purpose.toLowerCase(Locale.ROOT)+"="+token+"\n\n链接仅可使用一次。如果不是你本人操作，请忽略此邮件。"); }
        catch (RuntimeException e) { db.execute("delete from recovery_tokens where token_hash=?",hash(token)); throw e; }
    }
    @Transactional
    public void consume(String token, String purpose, String newPassword) {
        String digest=hash(token);
        var candidate=db.fetchOptional("select user_id from recovery_tokens where token_hash=?",digest).orElseThrow(RecoveryService::invalid);
        UUID id=candidate.get(0,UUID.class);
        db.execute("select pg_advisory_xact_lock(hashtext(?))","recovery:"+id);
        var row=db.fetchOptional("delete from recovery_tokens where token_hash=? and purpose=? and expires_at>now() returning *",digest,purpose).orElseThrow(RecoveryService::invalid);
        var user=users.findById(id).filter(u->u.status()==UserStatus.ACTIVE).orElseThrow(RecoveryService::invalid);
        if (!user.passwordHash().equals(row.get("password_hash",String.class))) throw invalid();
        String email=row.get("email",String.class);
        if (purpose.equals("BIND")) {
            if (db.fetchOptional("select 1 from recovery_mailboxes where email=? and user_id<>?",email,id).isPresent()) throw ApiException.badRequest("EMAIL_UNAVAILABLE","此邮箱无法绑定，请使用其他邮箱。");
            db.execute("insert into recovery_mailboxes values(?,?) on conflict(user_id) do update set email=excluded.email",id,email);
        } else {
            if (!email.equals(email(id))) throw invalid();
            passwordPolicy.validate(newPassword);
            users.updatePassword(id,passwords.encode(newPassword)); users.revokeSessions(id);
        }
        db.execute("delete from recovery_tokens where user_id=?",id);
        audit.record(id,purpose.equals("BIND")?"RECOVERY_EMAIL_VERIFIED":"PASSWORD_RESET","USER",id.toString(),null,null,null,null,"SUCCEEDED","{}");
    }
    static String hash(String token) {
        if (token==null || !token.matches("[A-Za-z0-9_-]{43}")) throw invalid();
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private static ApiException invalid() { return ApiException.badRequest("RECOVERY_LINK_INVALID","链接无效或已过期，请重新申请。"); }
}
