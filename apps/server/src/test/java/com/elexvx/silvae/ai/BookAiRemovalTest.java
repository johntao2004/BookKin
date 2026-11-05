package com.elexvx.silvae.ai;

import com.elexvx.silvae.common.ApiException;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BookAiRemovalTest {
    @Test void rejectsLegacyBookRequestsBeforeCallingTheService() {
        var service = mock(AiAssistanceService.class);
        var controller = new AiAssistanceController(service);
        var input = new AiAssistanceController.Input(AiAssistanceService.SourceType.BOOK, null,
                AiAssistanceService.Action.SUMMARY, null, null, true);
        assertThatThrownBy(() -> controller.assist(input, () -> "reader"))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("BOOK_AI_DISABLED"));
        verifyNoInteractions(service);
    }
}
