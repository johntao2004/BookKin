package io.github.johntao2004.bookkin.auth;

import io.github.johntao2004.bookkin.ai.AiSettingsCrypto;
import io.github.johntao2004.bookkin.common.ApiException;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.util.Set;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;

@Service
public class MailService {
    private final DSLContext db;
    private final AiSettingsCrypto crypto;
    public MailService(DSLContext db, AiSettingsCrypto crypto) { this.db = db; this.crypto = crypto; }
    public record Settings(boolean enabled, @NotBlank @Size(max=253) String host,
            @Min(1) @Max(65535) int port, @NotBlank String security,
            @NotNull @Size(max=320) String username, @Size(max=1000) String password,
            @NotBlank @Email @Size(max=320) String sender,
            @NotBlank @Size(max=1000) String publicUrl, boolean passwordConfigured) {}
    public Settings settings() {
        var row = db.fetchOne("select * from mail_settings where id=1");
        if (row == null) return new Settings(false,"",587,"STARTTLS","","","","",false);
        return new Settings(row.get("enabled",Boolean.class),row.get("host",String.class),row.get("port",Integer.class),
            row.get("security",String.class),row.get("username",String.class),"",row.get("sender",String.class),
            row.get("public_url",String.class),row.get("password_ciphertext") != null);
    }
    public Settings save(Settings input) {
        validate(input);
        if (input.password() != null && !input.password().isBlank() && !crypto.isConfigured())
            throw ApiException.badRequest("MAIL_ENCRYPTION_MISSING", "实例尚未配置密钥加密，请先配置 BOOKKIN_AI_SETTINGS_ENCRYPTION_KEY。");
        String secret = input.password() == null || input.password().isEmpty() ?
            db.fetchOptional("select password_ciphertext from mail_settings where id=1").map(r -> r.get(0,String.class)).orElse(null) : crypto.encrypt(input.password());
        db.execute("""
            insert into mail_settings values(1,?,?,?,?,?,?,?,?,now())
            on conflict(id) do update set enabled=excluded.enabled,host=excluded.host,port=excluded.port,
            security=excluded.security,username=excluded.username,password_ciphertext=excluded.password_ciphertext,
            sender=excluded.sender,public_url=excluded.public_url,updated_at=now()
            """,input.enabled(),input.host().trim(),input.port(),input.security(),input.username().trim(),secret,
            input.sender().trim(),input.publicUrl().replaceAll("/$", ""));
        return settings();
    }
    static void validate(Settings input) {
        if (!Set.of("STARTTLS","TLS","LOCAL").contains(input.security()) || input.host().matches(".*[\\s/@:]+.*"))
            throw ApiException.badRequest("MAIL_CONFIG_INVALID", "请检查 SMTP 主机和加密方式。");
        try {
            URI uri = URI.create(input.publicUrl());
            boolean local = Set.of("localhost","127.0.0.1","[::1]").contains(uri.getHost());
            if (uri.getHost() == null || uri.getUserInfo()!=null || uri.getQuery()!=null || uri.getFragment()!=null
                    || !("https".equals(uri.getScheme()) || (local && "http".equals(uri.getScheme())))
                    || !(uri.getPath().isEmpty() || uri.getPath().equals("/"))) throw new IllegalArgumentException();
        } catch (Exception e) { throw ApiException.badRequest("MAIL_URL_INVALID", "站点地址需要 HTTPS；本机测试可使用 http://127.0.0.1:4173。"); }
        if (input.security().equals("LOCAL") && !Set.of("localhost","127.0.0.1").contains(input.host()))
            throw ApiException.badRequest("MAIL_TLS_REQUIRED", "不加密模式仅允许连接本机测试邮件服务。");
    }
    public void send(String recipient, String subject, String body) {
        var s = settings();
        if (!s.enabled()) throw ApiException.badRequest("MAIL_DISABLED", "主人尚未启用邮件服务。");
        var mail = new JavaMailSenderImpl();
        mail.setHost(s.host()); mail.setPort(s.port()); mail.setUsername(s.username());
        var row = db.fetchOne("select password_ciphertext from mail_settings where id=1");
        mail.setPassword(crypto.decrypt(row.get(0,String.class)));
        var props = mail.getJavaMailProperties();
        props.setProperty("mail.smtp.auth",Boolean.toString(!s.username().isBlank()));
        props.setProperty("mail.smtp.starttls.enable",Boolean.toString(s.security().equals("STARTTLS")));
        props.setProperty("mail.smtp.starttls.required",Boolean.toString(s.security().equals("STARTTLS")));
        props.setProperty("mail.smtp.ssl.enable",Boolean.toString(s.security().equals("TLS")));
        props.setProperty("mail.smtp.ssl.checkserveridentity","true");
        for (String key : Set.of("connectiontimeout","timeout","writetimeout")) props.setProperty("mail.smtp."+key,"5000");
        var message = new SimpleMailMessage(); message.setFrom(s.sender()); message.setTo(recipient);
        message.setSubject(subject); message.setText(body);
        try { mail.send(message); }
        catch (Exception e) { throw ApiException.badRequest("MAIL_SEND_FAILED", "邮件未能发送，请检查邮件服务配置后重试。"); }
    }
}
