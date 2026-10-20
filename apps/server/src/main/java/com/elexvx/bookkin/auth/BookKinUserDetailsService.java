package com.elexvx.bookkin.auth;

import com.elexvx.bookkin.users.UserRepository;
import com.elexvx.bookkin.users.UserStatus;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
// 把账户记录映射为 Spring Security 身份及角色，禁用状态由认证框架消费。
// Maps accounts to Spring Security identities and roles, exposing disabled status to authentication.
public class BookKinUserDetailsService implements UserDetailsService {
    private final UserRepository users;

    public BookKinUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        var account = users.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Unknown user"));
        return User.withUsername(account.username())
                .password(account.passwordHash())
                .roles(account.role().name())
                .disabled(account.status() != UserStatus.ACTIVE)
                .build();
    }
}
