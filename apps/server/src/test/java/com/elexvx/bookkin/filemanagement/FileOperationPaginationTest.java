package com.elexvx.bookkin.filemanagement;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;
import com.elexvx.bookkin.common.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
class FileOperationPaginationTest {
    @ParameterizedTest @ValueSource(strings={"-1","wrong","2147483648","1.5",""})
    void rejectsInvalidPagesBeforeTouchingTheRepository(String page) {
        var repository=mock(FileOperationRepository.class);
        var controller=new FileOperationController(mock(FileOperationService.class),repository);
        var error=assertThrows(ApiException.class,()->controller.list("50",page,"10"));
        assertThat(error.status().value()).isEqualTo(400); assertThat(error.code()).isEqualTo("INVALID_PAGE"); verifyNoInteractions(repository);
    }
    @ParameterizedTest @ValueSource(strings={"0","101","wrong"})
    void rejectsInvalidPageSizes(String size) {
        var repository=mock(FileOperationRepository.class);
        var controller=new FileOperationController(mock(FileOperationService.class),repository);
        assertThat(assertThrows(ApiException.class,()->controller.list("50","0",size)).status().value()).isEqualTo(400);
        verifyNoInteractions(repository);
    }
    @Test void historyUsesAnAccurateTotalAndKeepsLegacyRecentRequestsCompatible() {
        var repository=mock(FileOperationRepository.class);when(repository.count()).thenReturn(121L);
        var controller=new FileOperationController(mock(FileOperationService.class),repository);
        assertThat(controller.list("50","12","10").total()).isEqualTo(121);verify(repository).page(12,10);
        assertThat(controller.list("50",null,"10").total()).isEqualTo(121);verify(repository).list(50);
    }
}
