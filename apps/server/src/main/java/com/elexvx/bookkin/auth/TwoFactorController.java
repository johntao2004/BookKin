package com.elexvx.bookkin.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

@RestController @Profile("api") @RequestMapping("/api/v1")
public class TwoFactorController {
    private final TwoFactorService service;
    public TwoFactorController(TwoFactorService service) { this.service=service; }
    @GetMapping("/users/vault-policy") @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public TwoFactorService.Policy policy() { return service.policy(); }
    @PutMapping("/users/vault-policy") @PreAuthorize("hasRole('OWNER')")
    public TwoFactorService.Policy policy(@Valid @RequestBody Policy input,Principal principal) { return service.savePolicy(input.enabled(),input.revision(),principal); }
    @GetMapping("/auth/two-factor/status")
    public TwoFactorService.Status status(Principal p,HttpServletRequest request) { return service.status(p,request.getSession(false)); }
    @PostMapping("/auth/two-factor/enrollment")
    public TwoFactorService.Enrollment begin(@Valid @RequestBody Password input,Principal p) { return service.begin(input.password(),p); }
    @PostMapping("/auth/two-factor/confirm")
    public TwoFactorService.Bound confirm(@Valid @RequestBody Confirmation input,Principal p,HttpServletRequest request) { return service.confirm(input.id(),input.code(),p,request.getSession()); }
    @PostMapping("/auth/two-factor/verify")
    public TwoFactorService.Status verify(@Valid @RequestBody Verification input,Principal p,HttpServletRequest request) { return service.verify(input.code(),input.recovery(),p,request.getSession()); }
    @PostMapping("/auth/two-factor/lock")
    public ResponseEntity<Void> lock(HttpServletRequest request) { service.lock(request.getSession(false)); return ResponseEntity.noContent().build(); }
    @PostMapping("/auth/two-factor/renew")
    public TwoFactorService.Status renew(Principal p,HttpServletRequest request) { return service.renew(p,request.getSession(false)); }
    @PostMapping("/auth/two-factor/reset")
    public ResponseEntity<Void> reset(@Valid @RequestBody Reset input,Principal p,HttpServletRequest request) { service.reset(input.password(),input.code(),input.recovery(),p,request.getSession()); return ResponseEntity.noContent().build(); }
    public record Policy(@NotNull Boolean enabled,@Min(0) long revision) {}
    public record Password(@NotBlank @Size(max=256) String password) {}
    public record Confirmation(@NotNull UUID id,@NotBlank @Pattern(regexp="[0-9]{6}") String code) {}
    public record Verification(@NotBlank @Size(max=80) String code,boolean recovery) {}
    public record Reset(@NotBlank @Size(max=256) String password,@NotBlank @Size(max=80) String code,boolean recovery) {}
}
