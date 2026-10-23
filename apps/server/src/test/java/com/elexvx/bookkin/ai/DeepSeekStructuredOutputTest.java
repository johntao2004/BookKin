package com.elexvx.bookkin.ai;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.elexvx.bookkin.config.BookKinProperties;
import com.elexvx.bookkin.config.BookKinProperties.AiProvider;
import com.elexvx.bookkin.config.BookKinProperties.AiProviderType;
import com.elexvx.bookkin.ingestion.upload.BookUploadRepository;
import java.io.ByteArrayOutputStream;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Flow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.json.JsonMapper;

class DeepSeekStructuredOutputTest {
    private final JsonMapper json = new JsonMapper();

    @ParameterizedTest
    @ValueSource(strings = {"https://api.deepseek.com/v1", "https://API.DEEPSEEK.COM"})
    void officialDeepSeekProducesGroundedJsonWithinTheExistingBudget(String baseUrl) throws Exception {
        var http = response("stop", "{\"points\":[{\"name\":\"温湿度监测\",\"quote\":\"温湿度监测是持续记录保存环境温度和相对湿度的方法。\",\"locator\":\"page:1\"}]}");
        var result = service(baseUrl, http).extractKnowledge(List.of(new AiMetadataService.KnowledgePassage(
                "page:1", "温湿度监测是持续记录保存环境温度和相对湿度的方法。")));
        assertEquals(1, result.points().size());
        var body = requestBody(http);
        assertEquals("disabled", body.at("/thinking/type").asText());
        assertEquals(4096, body.path("max_tokens").asInt());
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://api.openai.com/v1", "https://api.deepseek.com.example.org/v1", "http://127.0.0.1:8088/v1", ""})
    void compatibleProvidersDoNotReceiveDeepSeekOnlyOptions(String baseUrl) throws Exception {
        var http = response("stop", "{\"points\":[]}");
        service(baseUrl, http).extractKnowledge(List.of());
        assertFalse(requestBody(http).has("thinking"));
    }

    @Test
    void truncatedOutputIsRejectedEvenWhenItsPartialBodyLooksLikeValidJson() throws Exception {
        var http = response("length", "{\"points\":[]}");
        var error = assertThrows(IllegalStateException.class,
                () -> service("https://api.deepseek.com/v1", http).extractKnowledge(List.of()));
        assertTrue(error.getMessage().contains("长度限制"));
    }

    private AiMetadataService service(String baseUrl, HttpClient http) {
        var provider = new AiProvider("deepseek", "DeepSeek", AiProviderType.OPENAI_COMPATIBLE, true,
                baseUrl, "fixture-key", "deepseek-flash");
        var properties = new BookKinProperties(null, null, null, null, null, null, null, null, null, null,
                new BookKinProperties.Ai(true, false, 3, Duration.ofSeconds(5), List.of(provider), "fixture-key"));
        return new AiMetadataService(properties, mock(BookUploadRepository.class), json, http);
    }

    @SuppressWarnings("unchecked")
    private HttpClient response(String finishReason, String content) throws Exception {
        var http = mock(HttpClient.class);
        var response = (HttpResponse<String>) mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn(json.writeValueAsString(java.util.Map.of("choices", List.of(
                java.util.Map.of("finish_reason", finishReason, "message", java.util.Map.of("content", content))))));
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
        return http;
    }

    private tools.jackson.databind.JsonNode requestBody(HttpClient http) throws Exception {
        var request = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(request.capture(), any(HttpResponse.BodyHandler.class));
        var bytes = new ByteArrayOutputStream();
        var completed = new CompletableFuture<Void>();
        request.getValue().bodyPublisher().orElseThrow().subscribe(new Flow.Subscriber<ByteBuffer>() {
            public void onSubscribe(Flow.Subscription subscription) { subscription.request(Long.MAX_VALUE); }
            public void onNext(ByteBuffer buffer) {
                var chunk = new byte[buffer.remaining()];
                buffer.get(chunk);
                bytes.writeBytes(chunk);
            }
            public void onError(Throwable error) { completed.completeExceptionally(error); }
            public void onComplete() { completed.complete(null); }
        });
        completed.get(5, java.util.concurrent.TimeUnit.SECONDS);
        return json.readTree(bytes.toString(StandardCharsets.UTF_8));
    }
}
