package com.elexvx.bookkin.annotations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.elexvx.bookkin.catalog.BookRepository;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.jooq.tools.jdbc.MockConnection;
import org.jooq.tools.jdbc.MockResult;
import org.junit.jupiter.api.Test;

class AnnotationSearchTest {
    @Test
    void searchUsesThePrincipalOwnerEvenForAnAdministrator() {
        UUID owner = UUID.randomUUID();
        var user = mock(BookKinUser.class);
        when(user.id()).thenReturn(owner);
        var users = mock(UserRepository.class);
        when(users.findByUsername("administrator")).thenReturn(Optional.of(user));
        var repository = mock(AnnotationRepository.class);
        when(repository.search(owner, null, "needle")).thenReturn(List.of());
        var controller = new AnnotationController(repository, users, mock(BookRepository.class), mock(AnnotationExportService.class));

        controller.list(null, "  needle  ", () -> "administrator");

        verify(repository).search(owner, null, "needle");
        verifyNoMoreInteractions(repository);
    }

    @Test
    void keywordIsBoundAndOwnershipFilteringPrecedesTheResultLimit() {
        UUID owner = UUID.randomUUID();
        String keyword = "x' OR true --";
        var connection = new MockConnection(context -> {
            assertThat(context.sql()).contains("a.user_id = ?", "a.book_id = ?", "position(lower(?)", "limit 500");
            assertThat(context.sql()).doesNotContain(keyword);
            assertThat(context.bindings()).containsExactly(owner, null, null, keyword);
            return new MockResult[] { new MockResult(0, DSL.using(SQLDialect.POSTGRES).newResult()) };
        });
        var repository = new AnnotationRepository(DSL.using(connection, SQLDialect.POSTGRES));

        assertThat(repository.search(owner, null, keyword)).isEmpty();
    }
}
