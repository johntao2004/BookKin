package com.elexvx.bookkin.catalog;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.hamcrest.Matchers.containsString;

import com.elexvx.bookkin.articles.ArticleNotesController;
import com.elexvx.bookkin.articles.ArticleNotesService;
import com.elexvx.bookkin.annotations.ReadingPostsController;
import com.elexvx.bookkin.annotations.ReadingPostsService;
import com.elexvx.bookkin.articles.ArticleController;
import com.elexvx.bookkin.articles.ArticleService;
import com.elexvx.bookkin.auth.MustChangePasswordFilter;
import com.elexvx.bookkin.auth.SecurityConfig;
import com.elexvx.bookkin.auth.SessionLifetimeFilter;
import com.elexvx.bookkin.auth.SessionLifecycleService;
import com.elexvx.bookkin.users.UserRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

@SpringJUnitWebConfig(BookReviewAuthenticationTest.Config.class)
@ActiveProfiles("api")
class BookReviewAuthenticationTest {
    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    @Import({SecurityConfig.class, ArticleController.class, ArticleNotesController.class, BookReviewController.class, ReadingPostsController.class})
    static class Config {
        @Bean SessionLifecycleService sessionLifecycle() {
            var service = mock(SessionLifecycleService.class);
            when(service.status(any())).thenReturn(new SessionLifecycleService.Status(
                    Long.MAX_VALUE, false, System.currentTimeMillis()));
            return service;
        }

        @Bean SessionLifetimeFilter sessionLifetimeFilter(SessionLifecycleService service) {
            return new SessionLifetimeFilter(service);
        }

        @Bean UserRepository users() { return com.elexvx.bookkin.auth.PermissionTestFixtures.users(); }

        @Bean com.elexvx.bookkin.auth.RolePermissionService permissions() { return com.elexvx.bookkin.auth.PermissionTestFixtures.permissions(); }

        @Bean MustChangePasswordFilter passwordFilter(UserRepository users) {
            return new MustChangePasswordFilter(users);
        }

        @Bean ArticleNotesService articleNotes() { return mock(ArticleNotesService.class); }

        @Bean ArticleService articles() { return mock(ArticleService.class); }

        @Bean BookReviewService bookReviews() { return mock(BookReviewService.class); }
        @Bean ReadingPostsService readingPosts() { return mock(ReadingPostsService.class); }
    }

    @Autowired WebApplicationContext context;
    @Autowired ArticleNotesService articleNotes;
    @Autowired BookReviewService bookReviews;
    MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        when(articleNotes.notes(any())).thenReturn(List.of());
        when(bookReviews.list(any(UUID.class), any())).thenReturn(List.of());
    }

    @Test
    void anonymousCannotReadArticleNotesOrBookReviews() throws Exception {
        UUID id = UUID.randomUUID();
        clearInvocations(articleNotes, bookReviews);
        mvc.perform(get("/api/v1/articles/notes")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/books/{bookId}/reviews", id)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/books/{bookId}/reviews", id).with(csrf()).contentType("application/json")
                        .content("{\"title\":\"标题\",\"markdown\":\"正文\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/book-reviews/{id}", id).with(csrf()).contentType("application/json")
                        .content("{\"title\":\"标题\",\"markdown\":\"正文\",\"revision\":1}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(articleNotes, bookReviews);
    }

    @Test
    void loggedInMemberCanReachBothReadEndpoints() throws Exception {
        UUID id = UUID.randomUUID();
        mvc.perform(get("/api/v1/articles/notes").with(user("reader").roles("MEMBER")))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")));
        mvc.perform(get("/api/v1/books/{bookId}/reviews", id).with(user("reader").roles("MEMBER")))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")));
    }

    @Test
    void readingPostsRequireAuthenticationCsrfAndNoStoreResponses() throws Exception {
        UUID id = UUID.randomUUID();
        mvc.perform(get("/api/v1/reading-posts")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/reading-posts/ARTICLE/{id}", id)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/reading-posts?kind=ALL").with(user("reader").roles("MEMBER")))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", containsString("no-store")));
        mvc.perform(post("/api/v1/reading-posts").with(user("reader").roles("MEMBER"))
                .contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/reading-posts/ARTICLE/{id}", id).with(user("reader").roles("MEMBER")).with(csrf())
                .contentType("application/json").content("{\"title\":\"标题\",\"markdown\":\"正文\",\"revision\":0}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void loggedInMemberCanCreateAndUpdateTheirOwnReview() throws Exception {
        UUID bookId = UUID.randomUUID();
        UUID reviewId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var now = OffsetDateTime.now();
        var stored = new BookReviewRepository.BookReview(reviewId, bookId, userId, "Reader", "标题", "正文",
                ReviewVisibility.PRIVATE, 1, now, now);
        when(bookReviews.create(eq(bookId), eq("标题"), eq("正文"), isNull(), any())).thenReturn(stored);
        when(bookReviews.update(eq(reviewId), eq("标题"), eq("正文"), isNull(), eq(1L), any())).thenReturn(stored);
        String body = "{\"title\":\"标题\",\"markdown\":\"正文\"}";

        mvc.perform(post("/api/v1/books/{bookId}/reviews", bookId).with(user("reader").roles("MEMBER")).with(csrf())
                        .contentType("application/json").content(body))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")));
        mvc.perform(put("/api/v1/book-reviews/{id}", reviewId).with(user("reader").roles("MEMBER")).with(csrf())
                        .contentType("application/json").content("{\"title\":\"标题\",\"markdown\":\"正文\",\"revision\":1}"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")));
    }
}
