package com.elexvx.bookkin.users;
import java.security.Principal;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
@RestController @Profile("api") @RequestMapping("/api/v1/users")
public class UserRoleController {
    private final UserRoleService roles;
    public UserRoleController(UserRoleService roles) { this.roles = roles; }
    @PatchMapping("/{id}/role") @PreAuthorize("hasRole('OWNER')")
    public UserController.ManagedUser change(@PathVariable UUID id, @Valid @RequestBody Change input, Principal principal) {
        return UserController.ManagedUser.from(roles.change(id, input.expectedRole(), input.role(), principal));
    }
    public record Change(@NotNull UserRole expectedRole, @NotNull UserRole role) {}
}
