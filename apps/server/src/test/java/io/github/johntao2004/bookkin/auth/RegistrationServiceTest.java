package io.github.johntao2004.bookkin.auth;
import io.github.johntao2004.bookkin.users.*;
import io.github.johntao2004.bookkin.audit.AuditService;
import io.github.johntao2004.bookkin.common.ApiException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class RegistrationServiceTest {
 final RegistrationPolicyRepository policy=mock(RegistrationPolicyRepository.class);
 final UserRepository users=mock(UserRepository.class);
 final PasswordEncoder encoder=mock(PasswordEncoder.class);
 final AuditService audit=mock(AuditService.class);
 final RegistrationService service=new RegistrationService(policy,users,encoder,audit);
 @Test void closedPolicyRejectsWithoutCreatingAccount() {
  when(policy.lock()).thenReturn(false);
  assertThatThrownBy(()->service.register("reader","Reader","password12345")).isInstanceOf(ApiException.class);
  verify(users,never()).create(any(),any(),any(),any(),anyBoolean());verifyNoInteractions(encoder);
 }
 @Test void registrationRequiresInitializedOwner() {
  when(policy.lock()).thenReturn(true);
  assertThatThrownBy(()->service.register("reader","Reader","password12345")).isInstanceOf(ApiException.class);
  verify(users,never()).create(any(),any(),any(),any(),anyBoolean());
 }
 @Test void openPolicyCreatesOnlyMemberWithEncodedPassword() {
  when(policy.lock()).thenReturn(true);when(users.findOwner()).thenReturn(Optional.of(mock(BookKinUser.class)));
  when(encoder.encode("password12345")).thenReturn("hashed");
  var created=mock(BookKinUser.class);when(created.id()).thenReturn(UUID.randomUUID());
  when(users.create("reader","Reader","hashed",UserRole.MEMBER,false)).thenReturn(created);
  service.register("reader","Reader","password12345");
  verify(users).create("reader","Reader","hashed",UserRole.MEMBER,false);
 }
 @Test void duplicateNameRejectedBeforePasswordHash() {
  when(policy.lock()).thenReturn(true);when(users.findOwner()).thenReturn(Optional.of(mock(BookKinUser.class)));
  when(users.findByUsername("reader")).thenReturn(Optional.of(mock(BookKinUser.class)));
  assertThatThrownBy(()->service.register("reader","Reader","password12345")).isInstanceOf(ApiException.class);verifyNoInteractions(encoder);
 }
 @Test void administratorCannotChangePolicy() {
  var admin=mock(BookKinUser.class);when(admin.role()).thenReturn(UserRole.ADMIN);when(users.findByUsername("admin")).thenReturn(Optional.of(admin));
  assertThatThrownBy(()->service.configure("admin",true)).isInstanceOf(ApiException.class);verifyNoInteractions(policy);
 }
 @Test void ownerCanEnableAndDisableWithAudit() {
  var owner=mock(BookKinUser.class);when(owner.role()).thenReturn(UserRole.OWNER);when(owner.id()).thenReturn(UUID.randomUUID());when(users.findByUsername("owner")).thenReturn(Optional.of(owner));
  service.configure("owner",true);service.configure("owner",false);
  verify(policy).update(true);verify(policy).update(false);verify(audit,times(2)).record(any(),eq("REGISTRATION_POLICY_CHANGED"),any(),any(),isNull(),isNull(),isNull(),isNull(),eq("SUCCEEDED"),any());
 }
 @Test void registrationLimitCountsSuccessfulAttemptsToo() {
  var limiter=new LoginRateLimiter();for(int i=0;i<8;i++)limiter.consumeRegistration("192.168.1.5");
  assertThatThrownBy(()->limiter.consumeRegistration("192.168.1.5")).isInstanceOf(ApiException.class);
  limiter.consumeRegistration("192.168.1.6");
 }
}
