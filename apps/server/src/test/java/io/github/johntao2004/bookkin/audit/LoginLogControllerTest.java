package io.github.johntao2004.bookkin.audit;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class LoginLogControllerTest {
 @Test void boundsPageSizeAndOffset() {
  var audit = mock(AuditService.class); var controller = new LoginLogController(audit);
  when(audit.loginCount()).thenReturn(123L);
  assertThat(controller.list(-5,10000).total()).isEqualTo(123L);
  verify(audit).loginEntries(0,100);
  controller.list(Integer.MAX_VALUE,0);
  verify(audit).loginEntries(1000000,1);
 }
}
