package io.github.johntao2004.bookkin.auth;

import io.github.johntao2004.bookkin.users.UserRepository;
import io.github.johntao2004.bookkin.users.UserStatus;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
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
