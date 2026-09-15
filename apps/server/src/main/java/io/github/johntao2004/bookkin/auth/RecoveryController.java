package io.github.johntao2004.bookkin.auth;

import io.github.johntao2004.bookkin.users.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("api")
@RequestMapping("/api/v1")
public class RecoveryController {
    private final MailService mail;
    private final RecoveryService recovery;
    private final UserRepository users;
    private final LoginRateLimiter limiter;
    public RecoveryController(MailService mail, RecoveryService recovery, UserRepository users, LoginRateLimiter limiter) {
        this.mail=mail; this.recovery=recovery; this.users=users; this.limiter=limiter;
    }
    @GetMapping("/mail/settings") @PreAuthorize("hasRole('OWNER')")
    MailService.Settings settings() { return mail.settings(); }
    @PutMapping("/mail/settings") @PreAuthorize("hasRole('OWNER')")
    MailService.Settings save(@Valid @RequestBody MailService.Settings input) { return mail.save(input); }
    @PostMapping("/mail/test") @PreAuthorize("hasRole('OWNER')")
    void test(@Valid @RequestBody EmailInput input, HttpServletRequest req) {
        limit("test:"+req.getRemoteAddr()); mail.send(input.email(),"BookKin 测试邮件","邮件服务已连接成功。你可以使用此服务发送邮箱验证和密码重置链接。");
    }
    @GetMapping("/auth/recovery-email")
    Map<String,String> email(Principal p) { return Map.of("email",recovery.email(users.findByUsername(p.getName()).orElseThrow().id())); }
    @PostMapping("/auth/recovery-email")
    void bind(@Valid @RequestBody BindInput input, Principal p, HttpServletRequest req) {
        limit("bind:"+req.getRemoteAddr()); recovery.bind(users.findByUsername(p.getName()).orElseThrow(),input.email(),input.password());
    }
    @PostMapping("/auth/recovery/request")
    void request(@Valid @RequestBody EmailInput input, HttpServletRequest req) {
        limit("request-ip:"+req.getRemoteAddr()); limit("request-email:"+input.email().trim().toLowerCase(java.util.Locale.ROOT)); recovery.request(input.email());
    }
    @PostMapping("/auth/recovery/verify")
    void verify(@Valid @RequestBody TokenInput input, HttpServletRequest req) {
        limit("verify:"+req.getRemoteAddr()); recovery.consume(input.token(),"BIND",null);
    }
    @PostMapping("/auth/recovery/reset")
    void reset(@Valid @RequestBody ResetInput input, HttpServletRequest req) {
        limit("reset:"+req.getRemoteAddr()); recovery.consume(input.token(),"RESET",input.password());
    }
    private void limit(String key) { limiter.consumeRecovery(key); }
    public record EmailInput(@NotBlank @Email @Size(max=320) String email) {}
    public record BindInput(@NotBlank @Email @Size(max=320) String email,@NotBlank @Size(max=200) String password) {}
    public record TokenInput(@NotBlank @Size(max=100) String token) {}
    public record ResetInput(@NotBlank @Size(max=100) String token,@NotBlank @Size(max=200) String password) {}
}
