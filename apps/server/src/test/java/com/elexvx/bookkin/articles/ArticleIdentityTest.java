package com.elexvx.bookkin.articles;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ArticleIdentityTest {
    @Test void normalizesTrackingFragmentHostDefaultPortAndParameterOrder() {
        assertThat(ArticleIdentity.sourceKey(" HTTPS://Example.com:443/a/../article?b=2&utm_source=share&a=1#heading "))
                .isEqualTo(ArticleIdentity.sourceKey("https://example.com/article?a=1&b=2"));
        assertThat(ArticleIdentity.sourceKey("https://example.com/article?id=1"))
                .isNotEqualTo(ArticleIdentity.sourceKey("https://example.com/article?id=2"));
        assertThat(ArticleIdentity.sourceKey("https://example.com/Article"))
                .isNotEqualTo(ArticleIdentity.sourceKey("https://example.com/article"));
        assertThat(ArticleIdentity.sourceKey("https://example.com/article?from=one"))
                .isNotEqualTo(ArticleIdentity.sourceKey("https://example.com/article?from=two"));
    }

    @Test void recognizesWechatShareVariantsButPreservesArticleIdentity() {
        String base="https://mp.weixin.qq.com/s?__biz=abc%3D%3D&mid=123&idx=1&sn=abc";
        assertThat(ArticleIdentity.sourceKey(base+"&scene=1&from=singlemessage#wechat_redirect"))
                .isEqualTo(ArticleIdentity.sourceKey(base+"&scene=2&chksm=tracking"));
        assertThat(ArticleIdentity.sourceKey(base))
                .isNotEqualTo(ArticleIdentity.sourceKey(base.replace("idx=1","idx=2")));
        assertThat(ArticleIdentity.sourceKey("https://mp.weixin.qq.com/s/article-token?scene=1&from=singlemessage#wechat_redirect"))
                .isEqualTo(ArticleIdentity.sourceKey("https://mp.weixin.qq.com/s/article-token?scene=2"));
        assertThat(ArticleIdentity.sourceKey("https://mp.weixin.qq.com/s/article-token"))
                .isNotEqualTo(ArticleIdentity.sourceKey("https://mp.weixin.qq.com/s/another-token"));
    }

    @Test void excludesBlankAndInvalidSources() {
        for(String source:new String[]{""," ","not a link","javascript:alert(1)","https://example.com/?x=%zz"})
            assertThat(ArticleIdentity.sourceKey(source)).isEmpty();
    }

    @Test void ignoresFormattingButRetainsBodyDifferencesAndImageContents() {
        assertThat(ArticleIdentity.contentKey("<p id='p-1'>相同&nbsp; 正文</p>",s->s))
                .isEqualTo(ArticleIdentity.contentKey("<section><p><strong>相同 正文</strong></p></section>",s->s));
        assertThat(ArticleIdentity.contentKey("<p>正文一</p>",s->s))
                .isNotEqualTo(ArticleIdentity.contentKey("<p>正文二</p>",s->s));
        assertThat(ArticleIdentity.contentKey("<img src='first'>",s->"same-image-hash"))
                .isEqualTo(ArticleIdentity.contentKey("<img src='recaptured'>",s->"same-image-hash"));
        assertThat(ArticleIdentity.contentKey("<p>正文</p><img src='first'>",s->s))
                .isNotEqualTo(ArticleIdentity.contentKey("<p>正文</p><img src='different'>",s->s));
        assertThat(ArticleIdentity.contentKey("<p> </p>",s->s)).isEmpty();
    }
}
