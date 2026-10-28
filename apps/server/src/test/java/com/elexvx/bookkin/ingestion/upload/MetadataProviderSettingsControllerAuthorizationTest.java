package com.elexvx.bookkin.ingestion.upload;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

@SpringJUnitWebConfig(MetadataProviderSettingsControllerAuthorizationTest.Config.class)
@ActiveProfiles("api")
class MetadataProviderSettingsControllerAuthorizationTest {
    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @EnableMethodSecurity
    @Import(MetadataProviderSettingsController.class)
    static class Config {
        @Bean
        SecurityFilterChain security(HttpSecurity http) throws Exception {
            return http.authorizeHttpRequests(requests -> requests.anyRequest().authenticated())
                    .exceptionHandling(errors -> errors.authenticationEntryPoint((request, response, exception) -> response.setStatus(401)))
                    .build();
        }

        @Bean MetadataProviderSettingsService settings() { return mock(MetadataProviderSettingsService.class); }
    }

    @Autowired WebApplicationContext context;
    @Autowired MetadataProviderSettingsService settings;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        when(settings.view(org.mockito.ArgumentMatchers.any())).thenReturn(
                new MetadataProviderSettingsService.MetadataProviderSettingsView(List.of()));
    }

    @Test
    void rejectsNullOrEmptyProviderEntriesBeforeInvokingTheService() throws Exception {
        for (String body : List.of("{\"providers\":[null]}", "{\"providers\":[]}")) {
            mvc.perform(put("/api/v1/metadata-providers").with(user("admin").roles("ADMIN")).with(csrf())
                    .contentType("application/json").content(body)).andExpect(status().isBadRequest());
        }
    }

    @Test
    void readsAndWritesRequireOwnerOrAdminRole() throws Exception {
        mvc.perform(get("/api/v1/metadata-providers").with(user("admin").roles("ADMIN"))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/metadata-providers").with(user("owner").roles("OWNER"))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/metadata-providers").with(user("member").roles("MEMBER"))).andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/metadata-providers").with(user("admin").roles("ADMIN")).with(csrf())
                        .contentType("application/json").content("{\"providers\":[{\"id\":\"WIKIDATA\",\"enabled\":true}]}"))
                .andExpect(status().isOk());
        mvc.perform(put("/api/v1/metadata-providers").with(user("member").roles("MEMBER")).with(csrf())
                        .contentType("application/json").content("{\"providers\":[{\"id\":\"WIKIDATA\",\"enabled\":true}]}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/metadata-providers")).andExpect(status().isUnauthorized());
    }
}
