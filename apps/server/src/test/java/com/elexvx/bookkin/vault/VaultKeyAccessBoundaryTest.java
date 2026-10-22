package com.elexvx.bookkin.vault;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.elexvx.bookkin.auth.TwoFactorService;
import com.elexvx.bookkin.common.*;
import java.security.Principal;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;

class VaultKeyAccessBoundaryTest {
    @Test void keyEndpointsRequireFreshTwoFactorAndNeverCacheTheirResponses() throws Exception {
        var factors=mock(TwoFactorService.class);var keys=mock(VaultKeyService.class);
        Principal actor=()->"alice";var session=new MockHttpSession();var verified=new AtomicBoolean(false);
        doAnswer(invocation->{
            if(!verified.get() || invocation.getArgument(0)!=actor || invocation.getArgument(1)!=session)
                throw ApiException.forbidden("TWO_FACTOR_REQUIRED","请验证身份。");
            return null;
        }).when(factors).requireVaultAccess(any(),any());
        var registry=new InterceptorRegistry(){ public List<Object> registered(){return getInterceptors();} };
        new VaultAccessConfiguration(factors).addInterceptors(registry);
        var mvc=MockMvcBuilders.standaloneSetup(new VaultController(mock(VaultService.class),keys))
            .setControllerAdvice(new ApiExceptionHandler())
            .addInterceptors(registry.registered().toArray(HandlerInterceptor[]::new)).build();
        mvc.perform(post("/api/v1/vault/key/open").principal(actor).session(session))
            .andExpect(status().isForbidden()).andExpect(header().string("Cache-Control","no-store"));
        mvc.perform(post("/api/v1/vault/key/migrate").principal(actor).session(session)
            .contentType("application/json").content("{\"key\":\"test-key\",\"revision\":1}"))
            .andExpect(status().isForbidden());
        verifyNoInteractions(keys);
        verified.set(true);
        when(keys.open(actor)).thenReturn(new VaultKeyService.Access("test-key","envelope",2));
        mvc.perform(post("/api/v1/vault/key/open").principal(actor).session(session))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(jsonPath("$.key").value("test-key"));
        verified.set(false);
        mvc.perform(post("/api/v1/vault/key/open").principal(actor).session(session)).andExpect(status().isForbidden());
        verify(keys,times(1)).open(actor);verifyNoMoreInteractions(keys);
    }
}
