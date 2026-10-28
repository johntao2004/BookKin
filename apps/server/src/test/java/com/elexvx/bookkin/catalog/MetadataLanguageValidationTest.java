package com.elexvx.bookkin.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

class MetadataLanguageValidationTest {
    @Test
    void acceptsCommaSeparatedLanguageCodesUpTo1024Characters() {
        String atLimit = String.join(",", java.util.Collections.nCopies(340, "en")) + ",abcd";
        assertThat(atLimit).hasSize(1024);
        var factory = Validation.buildDefaultValidatorFactory();
        try {
            var validator = factory.getValidator();
            assertThat(validator.validate(request(atLimit))).isEmpty();
            assertThat(validator.validate(request(atLimit + "x")))
                    .extracting(violation -> violation.getPropertyPath().toString())
                    .containsExactly("language");
        } finally {
            factory.close();
        }
    }

    private MetadataController.MetadataRequest request(String language) {
        return new MetadataController.MetadataRequest(null, null, null, null, language, null, null, null,
                null, null, null, null, null, new String[]{"language"}, false, null, null, null, null, null);
    }
}
