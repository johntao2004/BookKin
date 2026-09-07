package io.github.johntao2004.bookkin.auth;
import io.github.johntao2004.bookkin.users.*;
import io.github.johntao2004.bookkin.audit.AuditService;
import io.github.johntao2004.bookkin.common.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
@Service
@org.springframework.context.annotation.Profile("api")
public class RegistrationService {
 private final RegistrationPolicyRepository policy;
 private final UserRepository users;
 private final PasswordEncoder passwords;
 private final AuditService audit;
 public RegistrationService(RegistrationPolicyRepository policy, UserRepository users, PasswordEncoder passwords, AuditService audit) { this.policy=policy; this.users=users; this.passwords=passwords; this.audit=audit; }
 public boolean enabled() { return policy.enabled() && users.findOwner().isPresent(); }
 @Transactional
 public void configure(String username, boolean enabled) {
  var actor=users.findByUsername(username).orElseThrow(() -> ApiException.forbidden("OWNER_REQUIRED","仅主人可修改安全设置"));
  if(actor.role()!=UserRole.OWNER) throw ApiException.forbidden("OWNER_REQUIRED","仅主人可修改安全设置");
  policy.lock(); policy.update(enabled);
  audit.record(actor.id(),"REGISTRATION_POLICY_CHANGED","SECURITY","registration",null,null,null,null,"SUCCEEDED","{\"enabled\":"+enabled+"}");
 }
 @Transactional
 public void register(String username, String nickname, String password) {
  if(!policy.lock() || users.findOwner().isEmpty()) throw ApiException.forbidden("REGISTRATION_CLOSED","当前未开放注册");
  if(users.findByUsername(username).isPresent()) throw ApiException.conflict("USERNAME_TAKEN","用户名已被使用");
  var user=users.create(username,nickname,passwords.encode(password),UserRole.MEMBER,false);
  audit.record(user.id(),"USER_REGISTERED","USER",user.id().toString(),null,null,null,null,"SUCCEEDED",null);
 }
}
