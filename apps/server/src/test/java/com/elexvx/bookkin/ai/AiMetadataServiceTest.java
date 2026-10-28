// 验证兼容 OpenAI 的结构化候选解析及待审核标记，不把模型建议直接视为已应用元数据。
// Checks OpenAI-compatible candidate parsing and review-required status rather than treating suggestions as applied metadata.
package com.elexvx.bookkin.ai;

import static com.elexvx.bookkin.ingestion.upload.BookUploadModels.MetadataSource;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.sun.net.httpserver.HttpServer;
import com.elexvx.bookkin.config.BookKinProperties;
import com.elexvx.bookkin.config.BookKinProperties.AiProvider;
import com.elexvx.bookkin.config.BookKinProperties.AiProviderType;
import com.elexvx.bookkin.ingestion.upload.BookUploadModels.MetadataDraft;
import com.elexvx.bookkin.ingestion.upload.BookUploadRepository;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class AiMetadataServiceTest {
    @Test
    void preservesSameTitleEditionsParsesEditionFieldsAndRefreshBypassesCache() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        AtomicInteger requests = new AtomicInteger();
        server.createContext("/v1/chat/completions", exchange -> {
            requests.incrementAndGet();
            exchange.getRequestBody().readAllBytes();
            byte[] response = """
                    {"choices":[{"message":{"content":"{\\"candidates\\":[{\\"title\\":\\"百年孤独\\",\\"authors\\":[\\"加西亚·马尔克斯\\"],\\"publisher\\":\\"甲出版社\\",\\"publishedDate\\":\\"1967\\",\\"isbn\\":\\"9780000000001\\",\\"edition\\":\\"第一版\\",\\"language\\":\\"es\\",\\"sourceUrl\\":\\"https://openlibrary.org/books/OL1M\\",\\"confidence\\":0.94,\\"reason\\":\\"有来源记录\\"},{\\"title\\":\\"百年孤独\\",\\"authors\\":[\\"加西亚·马尔克斯\\"],\\"publisher\\":\\"乙出版社\\",\\"publishedDate\\":\\"1972\\",\\"isbn\\":\\"9780000000002\\",\\"edition\\":\\"修订版\\",\\"language\\":\\"es\\",\\"sourceUrl\\":\\"javascript:alert(1)\\",\\"confidence\\":0.91,\\"reason\\":\\"有版本记录\\"}]}"}}]}
                    """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            try (var output = exchange.getResponseBody()) { output.write(response); }
        });
        server.start();
        try {
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/v1";
            var provider = new AiProvider("local", "本地兼容平台", AiProviderType.OPENAI_COMPATIBLE, true, baseUrl, "", "test-model");
            var properties = new BookKinProperties(null, null, null, null, null, null, null, null, null, null,
                    new BookKinProperties.Ai(true, false, 4, java.time.Duration.ofSeconds(3), List.of(provider), "test-ai-settings-key"));
            var uploads = mock(BookUploadRepository.class);
            AtomicReference<String> cache = new AtomicReference<>();
            when(uploads.cached(anyString(), anyString())).thenAnswer(invocation -> cache.get());
            doAnswer(invocation -> { cache.set(invocation.getArgument(2)); return null; })
                    .when(uploads).cache(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(),
                            org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());
            var service = new AiMetadataService(properties, uploads, new JsonMapper());
            var draft = new MetadataDraft("百年孤独", null, List.of("未知作者"), List.of(), "zh-CN", null, null,
                    null, null, null, null, List.of(), null, null, Map.of(), "未知作者/百年孤独.epub");

            var result = service.match(draft, List.of(), null);

            assertEquals(2, result.candidates().size());
            var candidate = result.candidates().getFirst();
            assertEquals(MetadataSource.AI, candidate.provider());
            assertEquals("本地兼容平台", candidate.providerLabel());
            assertEquals("百年孤独", candidate.title());
            assertEquals(List.of("加西亚·马尔克斯"), candidate.authors());
            assertEquals("第一版", candidate.edition());
            assertEquals("es", candidate.language());
            assertEquals("https://openlibrary.org/books/OL1M", candidate.sourceUrl());
            assertTrue(candidate.requiresReview());
            assertNull(result.candidates().get(1).sourceUrl(), "unsafe source URLs must be discarded");

            service.match(draft, List.of(), null);
            assertEquals(1, requests.get(), "a normal match should use the stored AI response");
            service.match(draft, List.of(), null, true);
            assertEquals(2, requests.get(), "refresh must invoke the AI provider again");
        } finally {
            server.stop(0);
        }
    }
}
