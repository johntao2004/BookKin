package io.github.johntao2004.bookkin.ai;

import static io.github.johntao2004.bookkin.ingestion.upload.BookUploadModels.MetadataSource;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.sun.net.httpserver.HttpServer;
import io.github.johntao2004.bookkin.config.BookKinProperties;
import io.github.johntao2004.bookkin.config.BookKinProperties.AiProvider;
import io.github.johntao2004.bookkin.config.BookKinProperties.AiProviderType;
import io.github.johntao2004.bookkin.ingestion.upload.BookUploadModels.MetadataDraft;
import io.github.johntao2004.bookkin.ingestion.upload.BookUploadRepository;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class AiMetadataServiceTest {
    @Test
    void parsesOpenAiCompatibleStructuredCandidateAndMarksItForReview() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] response = """
                    {"choices":[{"message":{"content":"{\\"candidates\\":[{\\"title\\":\\"百年孤独\\",\\"authors\\":[\\"加西亚·马尔克斯\\"],\\"confidence\\":0.94,\\"reason\\":\\"书名与作者组合高度一致\\"}]}"}}]}
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
            when(uploads.cached(anyString(), anyString())).thenReturn(null);
            var service = new AiMetadataService(properties, uploads, new JsonMapper());
            var draft = new MetadataDraft("百年孤独", null, List.of("未知作者"), List.of(), "zh-CN", null, null,
                    null, null, null, null, List.of(), null, null, Map.of(), "未知作者/百年孤独.epub");

            var result = service.match(draft, List.of(), null);

            assertEquals(1, result.candidates().size());
            var candidate = result.candidates().getFirst();
            assertEquals(MetadataSource.AI, candidate.provider());
            assertEquals("本地兼容平台", candidate.providerLabel());
            assertEquals("百年孤独", candidate.title());
            assertEquals(List.of("加西亚·马尔克斯"), candidate.authors());
            assertTrue(candidate.requiresReview());
        } finally {
            server.stop(0);
        }
    }
}
