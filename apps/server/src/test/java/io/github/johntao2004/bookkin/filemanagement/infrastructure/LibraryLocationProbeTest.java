package io.github.johntao2004.bookkin.filemanagement.infrastructure;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import static org.assertj.core.api.Assertions.*;
class LibraryLocationProbeTest {
 @TempDir Path temporary;
 @Test void checksWithoutChangingFiles() throws Exception {
  Path base = temporary.toRealPath(); Path root = Files.createDirectory(base.resolve("books"));
  Path original = Files.writeString(root.resolve("original.epub"), "unchanged");
  var probe = new LibraryLocationProbe(base.toString());
  var result = probe.inspect(root.toString());
  assertThat(result.path()).isEqualTo(root.toString());
  assertThat(probe.inspect(root.toString()).fingerprint()).isEqualTo(result.fingerprint());
  assertThat(Files.readString(original)).isEqualTo("unchanged");
  try(var files = Files.list(root)) { assertThat(files.count()).isEqualTo(1); }
 }
 @Test void rejectsEscapesMissingAndLinks() throws Exception {
  Path base = temporary.toRealPath(); var probe = new LibraryLocationProbe(base.toString());
  Path root = Files.createDirectory(base.resolve("books"));
  Path link = Files.createSymbolicLink(base.resolve("link"), root);
  for(String path : new String[]{base.toString(), base.resolve("missing").toString(), base.resolve("../outside").toString(), link.toString(), "relative"}) {
   assertThatThrownBy(() -> probe.inspect(path)).isInstanceOf(IllegalArgumentException.class);
  }
 }
 @Test void replacementChangesFingerprint() throws Exception {
  Path base = temporary.toRealPath(); Path root = Files.createDirectory(base.resolve("books"));
  var probe = new LibraryLocationProbe(base.toString()); var before = probe.inspect(root.toString());
  Files.move(root, base.resolve("old")); Files.createDirectory(root);
  assertThat(probe.inspect(root.toString()).fingerprint()).isNotEqualTo(before.fingerprint());
 }
}
