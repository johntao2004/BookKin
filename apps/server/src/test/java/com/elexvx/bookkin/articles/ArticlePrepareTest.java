package com.elexvx.bookkin.articles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import java.io.IOException;
import java.security.Principal;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;

class ArticlePrepareTest {
    private static final Principal OWNER = () -> "owner";
    private static final UUID IMPORTED_ASSET = UUID.fromString("00000000-0000-4000-8000-000000000001");
    private static final UUID EXISTING_ASSET = UUID.fromString("00000000-0000-4000-8000-000000000002");

    @Test
    void downloadsRelativeImagesAgainstSourceUrlAndKeepsTextWithoutSavingArticle() {
        String resolvedImage = "https://example.test/articles/images/figure.png";
        var web = mock(PublicWebFetcher.class);
        when(web.get(eq(resolvedImage), eq(5 * 1024 * 1024)))
                .thenReturn(new PublicWebFetcher.Download(new byte[] {1, 2, 3}, "image/png", resolvedImage));
        var database = mock(DSLContext.class);
        var service = service(web, database, true);

        String prepared = service.prepare(
                "<p>前文</p><img src='../images/figure.png' alt='示意图'><p>后文</p>",
                "https://example.test/articles/2026/page.html", OWNER);

        assertThat(prepared).contains("前文", "后文", "alt=\"示意图\"",
                "/api/v1/articles/assets/" + IMPORTED_ASSET);
        assertThat(prepared).doesNotContain("../images/figure.png");
        verify(web).get(resolvedImage, 5 * 1024 * 1024);
        verifyNoInteractions(database);
    }

    @Test
    void validatesExistingInternalImageWithoutDownloadingItAgain() {
        String internal = "/api/v1/articles/assets/" + EXISTING_ASSET;
        var web = mock(PublicWebFetcher.class);
        var database = mock(DSLContext.class);
        var service = service(web, database, true);

        String prepared = service.prepare("<p>已有配图</p><img src='" + internal + "' alt='本地图片'>", "", OWNER);

        assertThat(prepared).contains("已有配图", internal, "本地图片");
        assertThat(service.internalImageChecks).isEqualTo(1);
        verifyNoInteractions(web, database);
    }

    @Test
    void failedRemoteImageKeepsSurroundingBodyAndAddsPlaceholder() {
        var web = mock(PublicWebFetcher.class);
        when(web.get(eq("https://cdn.example.test/missing.png"), eq(5 * 1024 * 1024)))
                .thenThrow(new IllegalStateException("offline"));
        var database = mock(DSLContext.class);
        var service = service(web, database, true);

        String prepared = service.prepare(
                "<p>图片前的正文</p><img src='https://cdn.example.test/missing.png'><p>图片后的正文</p>",
                "https://example.test/article", OWNER);

        assertThat(prepared).contains("图片前的正文", "图片后的正文", "[图片未能导入]")
                .doesNotContain("<img", "missing.png");
        verifyNoInteractions(database);
    }

    @Test
    void rejectsMembersEvenWhenCalledOutsideTheController() {
        var web = mock(PublicWebFetcher.class);
        var database = mock(DSLContext.class);
        var service = service(web, database, false);

        assertThatThrownBy(() -> service.prepare("<p>正文</p>", "", OWNER))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.code()).isEqualTo("MANAGER_REQUIRED"));
        verifyNoInteractions(web, database);
    }

    private static ArticlePrepareService service(PublicWebFetcher web, DSLContext database, boolean manager) {
        var user = mock(BookKinUser.class);
        when(user.id()).thenReturn(UUID.randomUUID());
        when(user.canManageFiles()).thenReturn(manager);
        var users = mock(UserRepository.class);
        when(users.findByUsername("owner")).thenReturn(Optional.of(user));
        return new ArticlePrepareService(database, users, web);
    }

    private static final class ArticlePrepareService extends ArticleService {
        private int internalImageChecks;

        ArticlePrepareService(DSLContext database, UserRepository users, PublicWebFetcher web) {
            super(database, users, web, null, null, null);
        }

        @Override public UUID asset(byte[] bytes, Principal principal) throws IOException {
            return IMPORTED_ASSET;
        }

        @Override public org.springframework.core.io.Resource image(UUID id, Principal principal) {
            internalImageChecks++;
            return new ByteArrayResource(new byte[] {1});
        }
    }
}
