package io.github.johntao2004.bookkin.ingestion;
import io.github.johntao2004.bookkin.filemanagement.infrastructure.LibraryLocationProbe;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class LibraryRootRegistrationServiceTest {
 final LibraryRootRepository roots = mock(LibraryRootRepository.class);
 final LibraryLocationProbe probe = mock(LibraryLocationProbe.class);
 final LibraryRootCapabilityService capabilities = mock(LibraryRootCapabilityService.class);
 final LibraryRootRegistrationService service = new LibraryRootRegistrationService(roots, probe, capabilities);
 LibraryRoot root(UUID id) { return new LibraryRoot(id,"Books","/library/books","/library/books",LibraryRoot.RootStatus.ONLINE,true,true,true,true,100L,null,null); }
 @Test void idempotentRetryReturnsSameRootWithoutWrites() {
  UUID id = UUID.randomUUID(); when(roots.findById(id)).thenReturn(Optional.of(root(id)));
  assertThat(service.create("Books","/library/books","fingerprint",id).id()).isEqualTo(id);
  verifyNoInteractions(probe,capabilities);
  assertThatThrownBy(() -> service.create("Other","/library/books","fingerprint",id)).isInstanceOf(IllegalArgumentException.class);
 }
 @Test void rejectsChangedDirectoryBeforeRegistration() {
  when(probe.inspect("/library/books")).thenReturn(new LibraryLocationProbe.Result("/library/books","new",true,100));
  assertThatThrownBy(() -> service.create("Books","/library/books","old",UUID.randomUUID())).isInstanceOf(IllegalArgumentException.class);
  verify(roots,never()).insert(any(),any(),any()); verifyNoInteractions(capabilities);
 }
 @Test void rejectsNestedRoot() {
  when(roots.findAll()).thenReturn(List.of(root(UUID.randomUUID())));
  when(probe.inspect("/library/books/child")).thenReturn(new LibraryLocationProbe.Result("/library/books/child","f",true,100));
  assertThatThrownBy(() -> service.preview("/library/books/child")).isInstanceOf(IllegalArgumentException.class);
 }
}
