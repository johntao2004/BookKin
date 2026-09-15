package io.github.johntao2004.bookkin.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import io.github.johntao2004.bookkin.users.*;
import io.github.johntao2004.bookkin.audit.AuditService;
import io.github.johntao2004.bookkin.common.ApiException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class ProfileServiceTest {
    final UserRepository users=mock(UserRepository.class);
    final PasswordEncoder passwords=mock(PasswordEncoder.class);
    final ProfileService service=new ProfileService(users,passwords,mock(AuditService.class));
    final BookKinUser user=new BookKinUser(UUID.randomUUID(),"member","Member","hash",UserRole.MEMBER,UserStatus.ACTIVE,false,null,null);
    void setup() { when(users.findByUsername("member")).thenReturn(Optional.of(user)); when(passwords.matches("correct","hash")).thenReturn(true); }
    @Test void rejectsWrongPasswordBeforeWriting() {
        setup(); assertThrows(ApiException.class,()->service.update("member","newname","Name","wrong"));
        verify(users,never()).updateProfile(any(),any(),any());
    }
    @Test void rejectsAnotherAccountsUsername() {
        setup(); when(users.findByUsername("taken")).thenReturn(Optional.of(new BookKinUser(UUID.randomUUID(),"taken","Other","hash",UserRole.MEMBER,UserStatus.ACTIVE,false,null,null)));
        assertThrows(ApiException.class,()->service.update("member","taken","Name","correct"));
        verify(users,never()).updateProfile(any(),any(),any());
    }
    @Test void renamesOnlyCurrentAccountAndRevokesOldIdentitySessions() {
        setup(); when(users.updateProfile(user.id(),"newname","Name")).thenReturn(user);
        service.update("member","NEWNAME"," Name ","correct");
        verify(users).updateProfile(user.id(),"newname","Name"); verify(users).revokeSessionsByUsername("member");
    }
    @Test void displayNameChangeDoesNotRevokeOtherSessions() {
        setup(); service.update("member","member","Name","correct");
        verify(users).updateProfile(user.id(),"member","Name"); verify(users,never()).revokeSessionsByUsername(any());
    }
}
