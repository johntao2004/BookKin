package io.github.johntao2004.bookkin.auth;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
@RestController
@Profile("api")
@RequestMapping("/api/v1")
public class PasswordPolicyController {
 private final PasswordPolicyService service;
 public PasswordPolicyController(PasswordPolicyService service) { this.service=service; }
 @GetMapping("/auth/password-policy") public PasswordPolicyService.Policy policy() {return service.policy();}
 @PutMapping("/users/password-policy") @PreAuthorize("hasRole('OWNER')")
 public PasswordPolicyService.Policy save(@Valid @RequestBody PasswordPolicyService.Policy input,Principal principal) {return service.save(principal.getName(),input);}
}
