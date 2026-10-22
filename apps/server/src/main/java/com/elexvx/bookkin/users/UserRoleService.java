package com.elexvx.bookkin.users;
import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.common.ApiException;
import java.security.Principal;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
public class UserRoleService {
    private final UserRepository users;
    private final AuditService audit;
    public UserRoleService(UserRepository users, AuditService audit) { this.users = users; this.audit = audit; }
    @Transactional public BookKinUser change(UUID id, UserRole expectedRole, UserRole role, Principal principal) {
        var actor = users.findByUsername(principal.getName()).orElseThrow();
        var target = users.findById(id).orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "用户不存在。"));
        if (actor.role() != UserRole.OWNER || actor.status() != UserStatus.ACTIVE) throw ApiException.forbidden("OWNER_REQUIRED", "只有主人可以调整用户角色。");
        if (target.role() == UserRole.OWNER || role == UserRole.OWNER || actor.id().equals(id)) throw ApiException.forbidden("OWNER_ROLE_FIXED", "主人角色不能通过此入口更改。");
        var updated = users.changeRole(id, expectedRole, role);
        audit.record(actor.id(), "USER_ROLE_CHANGED", "USER", id.toString(), null, null, null, null, "SUCCEEDED", "{\"from\":\"" + expectedRole.name() + "\",\"to\":\"" + role.name() + "\"}");
        return updated;
    }
}
