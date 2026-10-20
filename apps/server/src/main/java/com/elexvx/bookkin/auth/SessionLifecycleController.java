package com.elexvx.bookkin.auth;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import java.security.Principal;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
@RestController
@Profile("api")
@RequestMapping("/api/v1")
public class SessionLifecycleController {
    private final SessionLifecycleService service;
    public SessionLifecycleController(SessionLifecycleService service) {this.service=service;}
    @GetMapping("/auth/session-status")
    public SessionLifecycleService.Status status(HttpServletRequest request) {return service.status(request.getSession());}
    @GetMapping("/users/active-sessions") @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public List<SessionLifecycleService.ActiveSession> active(HttpServletRequest request) {return service.active(request.getSession().getId());}
    @GetMapping("/users/session-policy") @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public Policy policy() {return new Policy(service.maxMinutes());}
    @PutMapping("/users/session-policy") @PreAuthorize("hasRole('OWNER')")
    public Policy save(@Valid @RequestBody Policy input,Principal actor) {return new Policy(service.savePolicy(actor.getName(),input.maxMinutes()));}
    public record Policy(@Min(5) @Max(43200) int maxMinutes) {}
}
