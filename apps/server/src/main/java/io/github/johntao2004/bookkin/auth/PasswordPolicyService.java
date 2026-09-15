package io.github.johntao2004.bookkin.auth;

import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.audit.AuditService;
import io.github.johntao2004.bookkin.users.UserRepository;
import io.github.johntao2004.bookkin.users.UserRole;
import jakarta.validation.constraints.*;
import java.security.SecureRandom;
import java.util.ArrayList;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordPolicyService {
    private final DSLContext db;
    private final UserRepository users;
    private final AuditService audit;
    public PasswordPolicyService(DSLContext db, UserRepository users, AuditService audit) { this.db=db; this.users=users; this.audit=audit; }
    public record Policy(@Min(8) @Max(128) int minLength, @NotNull Boolean requireUppercase,
        @NotNull Boolean requireLowercase, @NotNull Boolean requireDigit, @NotNull Boolean requireSpecial) {}
    public Policy policy() {
        var r=db.fetchOne("select * from password_policy where id=1");
        return new Policy(r.get("min_length",Integer.class),r.get("require_uppercase",Boolean.class),
            r.get("require_lowercase",Boolean.class),r.get("require_digit",Boolean.class),r.get("require_special",Boolean.class));
    }
    @Transactional
    public Policy save(String username, Policy policy) {
        var actor=users.findByUsername(username).orElseThrow();
        if(actor.role()!=UserRole.OWNER) throw ApiException.forbidden("OWNER_REQUIRED","仅主人可修改密码规则。");
        db.execute("update password_policy set min_length=?,require_uppercase=?,require_lowercase=?,require_digit=?,require_special=? where id=1",
            policy.minLength(),policy.requireUppercase(),policy.requireLowercase(),policy.requireDigit(),policy.requireSpecial());
        audit.record(actor.id(),"PASSWORD_POLICY_CHANGED","SECURITY","password-policy",null,null,null,null,"SUCCEEDED","{}");
        return policy();
    }
    public void validate(String password) { validate(password,policy()); }
    static void validate(String password,Policy policy) {
        var errors=new ArrayList<String>();
        if(password==null || password.length()<policy.minLength() || password.length()>200) errors.add("长度需为 "+policy.minLength()+"–200 个字符");
        String value=password==null?"":password;
        if(value.isBlank()) errors.add("不能仅使用空白字符");
        if(policy.requireUppercase() && !value.matches("(?s).*[A-Z].*")) errors.add("包含大写字母 A–Z");
        if(policy.requireLowercase() && !value.matches("(?s).*[a-z].*")) errors.add("包含小写字母 a–z");
        if(policy.requireDigit() && !value.matches("(?s).*[0-9].*")) errors.add("包含数字 0–9");
        if(policy.requireSpecial() && !value.matches("(?s).*[\\x21-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\x7e].*")) errors.add("包含英文标点或符号");
        if(!errors.isEmpty()) throw ApiException.badRequest("PASSWORD_POLICY_VIOLATION","密码需满足："+String.join("；",errors)+"。");
    }
    public String temporaryPassword() {
        var policy=policy(); var random=new SecureRandom(); var value=new StringBuilder("Aa7!");
        String alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*_-";
        while(value.length()<Math.max(26,policy.minLength())) value.append(alphabet.charAt(random.nextInt(alphabet.length())));
        for(int i=value.length()-1;i>0;i--) {int j=random.nextInt(i+1);char c=value.charAt(i);value.setCharAt(i,value.charAt(j));value.setCharAt(j,c);}
        return value.toString();
    }
}
