package com.elexvx.bookkin.articles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.UserRepository;
import java.security.Principal;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class ArticleAiDisabledTest {
    @Test void knowledgeGenerationIsDisabledBeforeReadsWritesOrProviderCalls() {
        var db = mock(DSLContext.class);
        var users = mock(UserRepository.class);
        var ai = mock(AiMetadataService.class);
        var service = new ArticleService(db, users, null, null, ai, new ObjectMapper());
        Principal principal = () -> "owner";

        assertThatThrownBy(() -> service.generate(UUID.randomUUID(), principal))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.code()).isEqualTo("ARTICLE_AI_DISABLED");
                    assertThat(error.status().value()).isEqualTo(410);
                });
        verifyNoInteractions(db, users, ai);
    }
}
