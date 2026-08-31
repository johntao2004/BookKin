package io.github.johntao2004.bookkin.filemanagement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FileFingerprintsTest {
    @TempDir
    Path temporary;

    @Test
    void sha256IsStableAndChangesWithContent() throws Exception {
        FileFingerprints fingerprints = new FileFingerprints();
        Path file = temporary.resolve("book.epub");
        Files.writeString(file, "first");
        String first = fingerprints.sha256(file);
        assertEquals(first, fingerprints.sha256(file));
        Files.writeString(file, "second");
        assertNotEquals(first, fingerprints.sha256(file));
    }
}
