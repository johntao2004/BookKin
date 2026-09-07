package io.github.johntao2004.bookkin.audit;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
@RestController
@Profile("api")
@RequestMapping("/api/v1/users/login-logs")
@PreAuthorize("hasAnyRole('OWNER','ADMIN')")
public class LoginLogController {
 private final AuditService audit;
 public LoginLogController(AuditService audit) { this.audit = audit; }
 @GetMapping
 public Page list(@RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
  return new Page(audit.loginEntries(Math.max(0, Math.min(page, 1000000)), Math.max(1, Math.min(size, 100))), audit.loginCount());
 }
 public record Page(java.util.List<AuditService.LoginEntry> items, long total) {}
}
