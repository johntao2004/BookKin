// 验证分页大小与偏移量有界，防止日志查询接口接受无界请求。
// Verifies bounded page size and offsets for login-audit queries.
package com.elexvx.bookkin.audit;
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
