package io.github.johntao2004.bookkin.auth;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
@RestController
@Profile("api")
@RequestMapping("/api/v1")
public class RegistrationController {
 private final RegistrationService service;
 private final LoginRateLimiter limiter;
 public RegistrationController(RegistrationService service, LoginRateLimiter limiter) { this.service=service; this.limiter=limiter; }
 @GetMapping("/auth/registration-status")
 public Policy status() { return new Policy(service.enabled()); }
 @GetMapping("/users/security-settings")
 @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
 public Policy settings() { return status(); }
 @PutMapping("/users/security-settings")
 @PreAuthorize("hasRole('OWNER')")
 public Policy configure(@Valid @RequestBody Policy input, Principal principal) { service.configure(principal.getName(),input.registrationEnabled()); return status(); }
 @PostMapping("/auth/register")
 public Registered register(@Valid @RequestBody Registration input, HttpServletRequest request) {
  limiter.consumeRegistration(request.getRemoteAddr());
  service.register(input.username().trim(),input.displayName().trim(),input.password());
  return new Registered(true);
 }
 public record Registered(boolean registered) {}
 public record Policy(@NotNull Boolean registrationEnabled) {}
 public record Registration(@NotBlank @Pattern(regexp="[a-zA-Z0-9._-]{3,80}") String username, @NotBlank @Size(max=120) String displayName, @NotBlank @Size(min=12,max=200) String password) {}
}
