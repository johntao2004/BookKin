package com.elexvx.bookkin.auth;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
@RestController
@Profile("api")
@RequestMapping("/api/v1")
// 公开只读密码要求，修改入口仅允许主人；实际密码验证由共享服务执行。
// Exposes read-only password requirements publicly and owner-only updates; shared services enforce validation.
public class PasswordPolicyController {
 private final PasswordPolicyService service;
 public PasswordPolicyController(PasswordPolicyService service) { this.service=service; }
 @GetMapping("/auth/password-policy") public PasswordPolicyService.Policy policy() {return service.policy();}
 @PutMapping("/users/password-policy") @PreAuthorize("hasRole('OWNER')")
 public PasswordPolicyService.Policy save(@Valid @RequestBody PasswordPolicyService.Policy input,Principal principal) {return service.save(principal.getName(),input);}
}
