package com.elexvx.bookkin.auth;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import jakarta.servlet.FilterChain;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class SessionLifetimeFilterTest {
 @Test void expiredSessionsAreRejectedEvenWhenTheClientDoesNotRunItsTimer() throws Exception {
  var service=mock(SessionLifecycleService.class);var filter=new SessionLifetimeFilter(service);
  var request=new MockHttpServletRequest("GET","/api/v1/books");var session=new MockHttpSession();request.setSession(session);
  when(service.status(session)).thenReturn(new SessionLifecycleService.Status(System.currentTimeMillis()-1,false,System.currentTimeMillis()));
  var response=new MockHttpServletResponse();var chain=mock(FilterChain.class);filter.doFilter(request,response,chain);
  assertEquals(401,response.getStatus());assertTrue(session.isInvalid());verifyNoInteractions(chain);
 }
 @Test void pendingRevocationAllowsReadingSavesDuringTheGraceWindow() throws Exception {
  var service=mock(SessionLifecycleService.class);var filter=new SessionLifetimeFilter(service);
  var request=new MockHttpServletRequest("PUT","/api/v1/books/book/position");var session=new MockHttpSession();request.setSession(session);
  when(service.status(session)).thenReturn(new SessionLifecycleService.Status(System.currentTimeMillis()+30000,true,System.currentTimeMillis()));
  var response=new MockHttpServletResponse();var chain=mock(FilterChain.class);filter.doFilter(request,response,chain);
  verify(chain).doFilter(request,response);assertFalse(session.isInvalid());
 }
}
