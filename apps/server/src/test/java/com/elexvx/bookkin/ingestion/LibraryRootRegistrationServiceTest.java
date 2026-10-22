package com.elexvx.bookkin.ingestion;

import com.elexvx.bookkin.common.ApiException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LibraryRootRegistrationServiceTest {
    private final LibraryRootRegistrationService service = new LibraryRootRegistrationService();

    @Test void refusesDirectoryProbeWithoutAccessingTheFilesystem() {
        var error = assertThrows(ApiException.class, () -> service.preview("/does-not-exist"));
        assertThat(error.status().value()).isEqualTo(403);
        assertThat(error.code()).isEqualTo("LIBRARY_ROOT_REGISTRATION_DISABLED");
    }

    @Test void refusesRegistrationIncludingLegacyRetries() {
        var error = assertThrows(ApiException.class,
            () -> service.create("Books", "/library/books", "fingerprint", UUID.randomUUID()));
        assertThat(error.status().value()).isEqualTo(403);
        assertThat(error.code()).isEqualTo("LIBRARY_ROOT_REGISTRATION_DISABLED");
    }
}
