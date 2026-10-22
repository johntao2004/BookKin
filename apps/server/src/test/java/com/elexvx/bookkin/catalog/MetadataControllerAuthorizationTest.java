package com.elexvx.bookkin.catalog;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.elexvx.bookkin.filemanagement.FileOperationService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
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

@SpringJUnitWebConfig(MetadataControllerAuthorizationTest.Config.class)
@ActiveProfiles("api")
class MetadataControllerAuthorizationTest {
    private static final UUID BOOK_ID = UUID.fromString("6b07e2aa-1d15-4d47-a329-2678a7d91d20");

    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @EnableMethodSecurity
    @Import(MetadataController.class)
    static class Config {
        @Bean
        SecurityFilterChain testSecurityFilterChain(HttpSecurity http) throws Exception {
            return http.authorizeHttpRequests(requests -> requests.anyRequest().authenticated())
                    .exceptionHandling(errors -> errors.authenticationEntryPoint((request, response, exception) -> response.setStatus(401)))
                    .build();
        }

        @Bean BookMetadataRepository metadata() { return mock(BookMetadataRepository.class); }
        @Bean BookRepository books() { return mock(BookRepository.class); }
        @Bean FileOperationService fileOperations() { return mock(FileOperationService.class); }
        @Bean BookCoverService covers() { return mock(BookCoverService.class); }
        @Bean com.elexvx.bookkin.filemanagement.infrastructure.KnowledgeTextGateway source() { return mock(com.elexvx.bookkin.filemanagement.infrastructure.KnowledgeTextGateway.class); }
        @Bean MetadataEditingService editing() { return mock(MetadataEditingService.class); }
    }

    @Autowired WebApplicationContext context;
    @Autowired BookMetadataRepository metadata;
    @Autowired BookRepository books;
    @Autowired com.elexvx.bookkin.filemanagement.infrastructure.KnowledgeTextGateway source;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        when(metadata.find(BOOK_ID)).thenReturn(Optional.of(new BookMetadataRepository.BookMetadata(
                BOOK_ID, "普通书目", null, List.of("作者"), List.of(), "zh", "出版社", null, null,
                "简介", null, null, List.of(), List.of(), null, "/cover", Map.of(), false)));
    }

    @Test
    void authenticatedCatalogRolesCanReadMetadataButAnonymousCannot() throws Exception {
        for (String role : new String[]{"MEMBER", "ADMIN", "OWNER"}) {
            mvc.perform(get("/api/v1/books/{id}/metadata", BOOK_ID).with(user("reader").roles(role)))
                    .andExpect(status().isOk());
        }
        mvc.perform(get("/api/v1/books/{id}/metadata", BOOK_ID)).andExpect(status().isUnauthorized());
    }

    @Test
    void sourceBibliographyUsesTheSameCatalogReadRoles() throws Exception {
        var file = new BookFile(UUID.randomUUID(), BOOK_ID, UUID.randomUUID(), "test.epub", BookFormat.EPUB,
                BookFileStatus.AVAILABLE, 1, java.time.OffsetDateTime.now(), "sha256:test", false, false, false);
        when(books.findPreferredFile(BOOK_ID)).thenReturn(Optional.of(file));
        when(source.bibliography(file)).thenReturn(new com.elexvx.bookkin.filemanagement.infrastructure.BookBibliographyReader.Source(null, null, "目录", List.of("AKH")));
        for (var role : List.of("MEMBER", "ADMIN", "OWNER")) {
            mvc.perform(get("/api/v1/books/{id}/bibliography-source", BOOK_ID).with(user("reader").roles(role))).andExpect(status().isOk());
        }
        mvc.perform(get("/api/v1/books/{id}/bibliography-source", BOOK_ID)).andExpect(status().isUnauthorized());
    }

    @Test
    void memberCannotEditMetadataOrChangeCover() throws Exception {
        mvc.perform(patch("/api/v1/books/{id}/metadata", BOOK_ID).with(user("member").roles("MEMBER")).with(csrf())
                        .contentType("application/json").content("{\"title\":\"成员修改\",\"writeBack\":false}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/books/{id}/cover", BOOK_ID).with(user("member").roles("MEMBER")).with(csrf())
                        .contentType("image/png").content(new byte[]{1}))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/books/{id}/cover", BOOK_ID).with(user("member").roles("MEMBER")).with(csrf()))
                .andExpect(status().isForbidden());
    }
}
