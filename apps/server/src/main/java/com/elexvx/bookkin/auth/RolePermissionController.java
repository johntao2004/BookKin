package com.elexvx.bookkin.auth;
import java.security.Principal;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
@RestController @Profile("api") @RequestMapping("/api/v1")
public class RolePermissionController {
    private final RolePermissionService permissions;
    public RolePermissionController(RolePermissionService permissions) { this.permissions = permissions; }
    @GetMapping("/auth/permissions") public RolePermissionService.Snapshot current(Principal principal) { return permissions.snapshot(principal); }
    @GetMapping("/role-permissions") @PreAuthorize("hasRole('OWNER')")
    public RolePermissionService.Policy policy() { return permissions.policy(); }
    @PutMapping("/role-permissions") @PreAuthorize("hasRole('OWNER')")
    public RolePermissionService.Policy update(@RequestBody RolePermissionService.Policy input, Principal principal) { return permissions.update(input, principal); }
}
