package com.elexvx.bookkin.articles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Optional;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;

class ArticleCaptureTest {
    private static final Principal OWNER = () -> "owner";

    @Test void fetchPopulatesPublishedAtFromSourceMetadata() {
        String url = "https://example.test/article";
        String html = "<html><head><meta property='article:published_time' content='2024-02-03T09:08:07+08:00'></head>"
                + "<body><article><p>正文</p></article></body></html>";
        var fetcher = mock(PublicWebFetcher.class);
        when(fetcher.get(url, ArticleService.MAX_CAPTURE_HTML_BYTES)).thenReturn(new PublicWebFetcher.Download(
                html.getBytes(StandardCharsets.UTF_8), "text/html; charset=UTF-8", url));
        var service = new ArticleService(emptyDatabase(), ownerRepository(), fetcher, null, null, null);

        var draft = service.fetch(url, OWNER);

        assertThat(draft.publishedAt()).isEqualTo("2024-02-03 09:08:07+08:00");
    }

    @Test void capturesLargeWechatShellButKeepsOnlyItsArticleBody() {
        String url = "https://mp.weixin.qq.com/s/example";
        String html = "<html><body><h1 id='activity-name'>测试文章</h1><a id='js_name'>测试作者</a>"
                + "<div id='js_content'><p>需要保存的正文。</p></div><script>"
                + "x".repeat(3 * 1024 * 1024) + "</script></body></html>";
        byte[] bytes = html.getBytes(StandardCharsets.UTF_8);
        var fetcher = mock(PublicWebFetcher.class);
        when(fetcher.get(eq(url), anyInt())).thenAnswer(call -> {
            int limit = call.getArgument(1);
            assertThat(limit).isEqualTo(8 * 1024 * 1024).isGreaterThan(bytes.length);
            return new PublicWebFetcher.Download(bytes, "text/html; charset=UTF-8", url);
        });
        var owner = mock(BookKinUser.class);
        when(owner.id()).thenReturn(UUID.randomUUID());
        when(owner.canManageFiles()).thenReturn(true);
        var users = mock(UserRepository.class);
        when(users.findByUsername("owner")).thenReturn(Optional.of(owner));
        var service = new ArticleService(emptyDatabase(), users, fetcher, null, null, null);

        var draft = service.fetch(url, (Principal) () -> "owner");

        assertThat(draft.title()).isEqualTo("测试文章");
        assertThat(draft.author()).isEqualTo("测试作者");
        assertThat(draft.sourceUrl()).isEqualTo(url);
        assertThat(draft.html()).contains("需要保存的正文", "id=\"p-1\"").doesNotContain("script", "xxx");
    }

    @Test void importsSocialCoverLazyImagesAndInlineDiagramAsLocalPngs() throws Exception {
        String url="https://mp.weixin.qq.com/s/example";
        String html="<html><head><meta property='og:image' content='https://cdn.example/cover.png'></head><body>"
                +"<h1 id='activity-name'>图文文章</h1><div id='js_content'><p>正文</p>"
                +"<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60' viewBox='0 0 120 60' aria-roledescription='flowchart-v2'>"
                +"<rect x='1' y='1' width='118' height='58' fill='white' stroke='black'/><text x='10' y='30'>diagram</text></svg>"
                +"<img data-src='/lazy.png' src='data:image/png;base64,placeholder' alt='延迟图片'></div></body></html>";
        var web=mock(PublicWebFetcher.class);
        when(web.get(url,ArticleService.MAX_CAPTURE_HTML_BYTES)).thenReturn(new PublicWebFetcher.Download(html.getBytes(StandardCharsets.UTF_8),"text/html",url));
        byte[] png=png();
        when(web.get("https://cdn.example/cover.png",5*1024*1024)).thenReturn(new PublicWebFetcher.Download(png,"image/png","https://cdn.example/cover.png"));
        when(web.get("https://mp.weixin.qq.com/lazy.png",5*1024*1024)).thenReturn(new PublicWebFetcher.Download(png,"image/png","https://mp.weixin.qq.com/lazy.png"));
        var service=new ImageCaptureService(web);

        var draft=service.fetch(url,OWNER);
        var images=Jsoup.parseBodyFragment(draft.html()).select("img");

        assertThat(draft.coverUrl()).matches("/api/v1/articles/assets/[0-9a-f-]{36}");
        assertThat(images).hasSize(2);
        assertThat(images.eachAttr("alt")).containsExactly("文章流程图","延迟图片");
        assertThat(images.eachAttr("src")).allMatch(src->src.startsWith("/api/v1/articles/assets/"));
        assertThat(service.images).hasSize(3);
        assertThat(service.images.get(1).getWidth()).isEqualTo(120);
        assertThat(service.images.get(1).getHeight()).isEqualTo(60);
        assertThat(draft.html()).doesNotContain("<svg","[图片未能导入]","data-src=","https://cdn.example","文章封面");
    }

    @Test void doesNotDuplicateCoverAlreadyPresentInBody() throws Exception {
        String url="https://example.test/article";
        String html="<meta property='og:image' content='/cover.png'><article><p>正文</p><img src='/cover.png' alt='原图'></article>";
        var web=mock(PublicWebFetcher.class);
        when(web.get(url,ArticleService.MAX_CAPTURE_HTML_BYTES)).thenReturn(new PublicWebFetcher.Download(html.getBytes(StandardCharsets.UTF_8),"text/html",url));
        when(web.get("https://example.test/cover.png",5*1024*1024)).thenReturn(new PublicWebFetcher.Download(png(),"image/png","https://example.test/cover.png"));
        var service=new ImageCaptureService(web);
        var draft=service.fetch(url,OWNER);
        assertThat(draft.coverUrl()).matches("/api/v1/articles/assets/[0-9a-f-]{36}");
        assertThat(Jsoup.parseBodyFragment(draft.html()).select("img")).isEmpty();
        assertThat(service.images).hasSize(1);
    }

    @Test void keepsBodyImageWhenOptionalSocialCoverCaptureFails() throws Exception {
        String url="https://example.test/article";
        String html="<meta property='og:image' content='https://cdn.example/cover.png'><article><p>正文保留</p>"
                +"<img src='https://cdn.example/cover.png' alt='正文插图'></article>";
        var web=mock(PublicWebFetcher.class);
        when(web.get(url,ArticleService.MAX_CAPTURE_HTML_BYTES)).thenReturn(new PublicWebFetcher.Download(html.getBytes(StandardCharsets.UTF_8),"text/html",url));
        when(web.get("https://cdn.example/cover.png",5*1024*1024))
                .thenThrow(new IllegalStateException("cover unavailable"))
                .thenReturn(new PublicWebFetcher.Download(png(),"image/png","https://cdn.example/cover.png"));
        var service=new ImageCaptureService(web);

        var draft=service.fetch(url,OWNER);

        assertThat(draft.coverUrl()).isNull();
        assertThat(draft.html()).contains("正文保留","正文插图").doesNotContain("文章封面");
        assertThat(Jsoup.parseBodyFragment(draft.html()).select("img")).hasSize(1);
        assertThat(service.images).hasSize(1);
    }

    @Test void unsupportedDiagramDoesNotDropSurroundingArticleText() {
        var service=new ImageCaptureService(mock(PublicWebFetcher.class));
        var html=service.clean("<p>之前</p><svg width='999999' height='999999'><rect width='10' height='10'/></svg><p>之后</p>","https://example.test",OWNER);
        assertThat(html).contains("之前","之后","[图片未能导入]").doesNotContain("<svg");
        assertThat(service.images).isEmpty();
    }

    private static byte[] png() throws IOException {
        var out=new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(8,8,BufferedImage.TYPE_INT_RGB),"png",out);
        return out.toByteArray();
    }

    private static UserRepository ownerRepository() {
        var owner=mock(BookKinUser.class);
        when(owner.id()).thenReturn(UUID.randomUUID());
        when(owner.canManageFiles()).thenReturn(true);
        var users=mock(UserRepository.class);
        when(users.findByUsername("owner")).thenReturn(Optional.of(owner));
        return users;
    }

    private static org.jooq.DSLContext emptyDatabase() {
        var db=org.jooq.impl.DSL.using(org.jooq.SQLDialect.POSTGRES);
        return org.jooq.impl.DSL.using(new org.jooq.tools.jdbc.MockConnection(context -> new org.jooq.tools.jdbc.MockResult[]{
            new org.jooq.tools.jdbc.MockResult(0,db.newResult(org.jooq.impl.DSL.field("id",UUID.class),org.jooq.impl.DSL.field("source_url",String.class)))
        }),org.jooq.SQLDialect.POSTGRES);
    }

    private static class ImageCaptureService extends ArticleService {
        final ArrayList<BufferedImage> images=new ArrayList<>();
        ImageCaptureService(PublicWebFetcher web) {super(emptyDatabase(),ownerRepository(),web,null,null,null);}
        @Override public UUID asset(byte[] bytes,Principal principal)throws IOException {
            var image=ImageIO.read(new ByteArrayInputStream(bytes));
            if(image==null)throw new IOException("Image not decodable");
            images.add(image);
            return UUID.randomUUID();
        }
    }
}
