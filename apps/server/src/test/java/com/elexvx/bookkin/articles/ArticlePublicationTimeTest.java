package com.elexvx.bookkin.articles;

import static org.assertj.core.api.Assertions.assertThat;

import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;

import tools.jackson.databind.ObjectMapper;

class ArticlePublicationTimeTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test void prefersPublishedMetadataAndPreservesItsOffset() {
        var document = Jsoup.parse("""
                <meta property="article:published_time" content="2024-02-03T09:08:07+08:00">
                <meta itemprop="datePublished" content="2020-01-02">
                <script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2021-01-02"}</script>
                <time datetime="2022-01-02"></time>
                """);

        assertThat(ArticlePublicationTime.extract(document, json)).isEqualTo("2024-02-03 09:08:07+08:00");
    }

    @Test void skipsInvalidHigherPriorityValuesAndUsesSupportedJsonLdPublicationDate() {
        var document = Jsoup.parse("""
                <meta property="article:published_time" content="yesterday">
                <meta name="datePublished" content="2024-99-99">
                <script type="application/ld+json">
                  {"@graph":[
                    {"@type":"WebPage","datePublished":"2019-01-01"},
                    {"@type":["Thing","https://schema.org/BlogPosting"],"datePublished":"2022-03-04","dateModified":"2025-06-07"}
                  ]}
                </script>
                <time datetime="2020-01-01"></time>
                """);

        assertThat(ArticlePublicationTime.extract(document, json)).isEqualTo("2022-03-04");
    }

    @Test void fallsThroughMalformedStructuredDataToThePublishedTimeElement() {
        var document = Jsoup.parse("""
                <script type="application/ld+json">{"@type":"Article","datePublished":"not a date"}</script>
                <time datetime="2023-07-08T12:13:14Z"></time>
                """);

        assertThat(ArticlePublicationTime.extract(document, json)).isEqualTo("2023-07-08 12:13:14Z");
    }

    @Test void readsWechatVisiblePublicationTimeWithoutAddingSeconds() {
        var document = Jsoup.parse("<div id='publish_time'>2024年7月2日 09:20</div>", "https://mp.weixin.qq.com/s/example");

        assertThat(ArticlePublicationTime.extract(document, json)).isEqualTo("2024-07-02 09:20");
    }

    @Test void readsWechatCreateTimeStringAndEpochSecondsAndMilliseconds() {
        var createTime = Jsoup.parse("<script>{'create_time': '2020-09-13 12:26:40'};</script>", "https://mp.weixin.qq.com/s/example");
        var createTimeCamelCase = Jsoup.parse("<script>var createTime = '2020-09-13 12:26:40';</script>", "https://mp.weixin.qq.com/s/example");
        var seconds = Jsoup.parse("<script>{\"ct\": 1600000000}</script>", "https://mp.weixin.qq.com/s/example");
        var milliseconds = Jsoup.parse("<script>var ct = 1600000000000;</script>", "https://mp.weixin.qq.com/s/example");

        assertThat(ArticlePublicationTime.extract(createTime, json)).isEqualTo("2020-09-13 12:26:40");
        assertThat(ArticlePublicationTime.extract(createTimeCamelCase, json)).isEqualTo("2020-09-13 12:26:40");
        assertThat(ArticlePublicationTime.extract(seconds, json)).isEqualTo("2020-09-13 12:26:40Z");
        assertThat(ArticlePublicationTime.extract(milliseconds, json)).isEqualTo("2020-09-13 12:26:40Z");
    }

    @Test void readsThePublicationVariablesFoundInTheReportedWechatPage() {
        var document = Jsoup.parse("""
                <div id="publish_time"><em></em></div>
                <script>
                  var counter = 17;
                  var createTime = '2026-10-17 06:30';
                  create_time: '2026-10-17 06:30';
                  var create_time = "1792189800" * 1;
                  var ct = "1792189800";
                </script>
                """, "https://mp.weixin.qq.com/s/Ct9Dc3r0-viIfHFiP_VL6A");

        assertThat(ArticlePublicationTime.extract(document, json)).isEqualTo("2026-10-17 06:30");
    }

    @Test void ignoresWechatScriptDatesOutsideWechatAndSkipsExplicitModifiedTimes() {
        var otherSite = Jsoup.parse("<script>var createTime = '2024-01-02';</script>", "https://example.test/article");
        var modifiedTimes = Jsoup.parse("""
                <time itemprop="dateModified" datetime="2024-01-02T03:04:05Z"></time>
                <time class="updated" datetime="2024-01-03T03:04:05Z"></time>
                <time datetime="2022-02-03"></time>
                """);

        assertThat(ArticlePublicationTime.extract(otherSite, json)).isEmpty();
        assertThat(ArticlePublicationTime.extract(modifiedTimes, json)).isEqualTo("2022-02-03");
    }

    @Test void ignoresModifiedAndBodyDatesAndLeavesMissingPublicationTimeEmpty() {
        var document = Jsoup.parse("""
                <meta property="article:modified_time" content="2024-01-02T03:04:05Z">
                <script type="application/ld+json">{"@type":"Article","dateModified":"2024-01-02"}</script>
                <article>发表于 2020 年 1 月 2 日，更新于 2024 年 1 月 2 日。</article>
                """);

        assertThat(ArticlePublicationTime.extract(document, json)).isEmpty();
    }
}
