package io.github.johntao2004.bookkin.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("api")
@RequestMapping("/api/v1/auth/profile")
public class ProfileController {
    private final ProfileService profiles;
    private final AuthenticationManager authentication;
    private final HttpSessionSecurityContextRepository contexts;
    private final LoginRateLimiter limiter;
    public ProfileController(ProfileService profiles, AuthenticationManager authentication,
            HttpSessionSecurityContextRepository contexts, LoginRateLimiter limiter) {
        this.profiles=profiles; this.authentication=authentication; this.contexts=contexts; this.limiter=limiter;
    }
    @PutMapping
    AuthController.SessionUser update(@Valid @RequestBody UpdateProfile input, Principal principal,
            HttpServletRequest request, HttpServletResponse response) {
        String key="profile:"+principal.getName();
        limiter.check(key);
        io.github.johntao2004.bookkin.users.BookKinUser user;
        try { user=profiles.update(principal.getName(), input.username(), input.displayName(), input.currentPassword()); }
        catch (io.github.johntao2004.bookkin.common.ApiException error) { limiter.failure(key); throw error; }
        limiter.success(key);
        if (request.getSession(false) != null) request.getSession(false).invalidate();
        var auth=authentication.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(user.username(), input.currentPassword()));
        var context=SecurityContextHolder.createEmptyContext(); context.setAuthentication(auth);
        SecurityContextHolder.setContext(context); contexts.saveContext(context, request, response);
        return AuthController.SessionUser.from(user);
    }
    public record UpdateProfile(
        @NotBlank @Pattern(regexp="[a-zA-Z0-9._-]{3,80}") String username,
        @NotBlank @Size(max=120) String displayName,
        @NotBlank @Size(max=200) String currentPassword) {}
}
