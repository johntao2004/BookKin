package io.github.johntao2004.bookkin.filemanagement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.johntao2004.bookkin.common.ApiException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PathPolicyTest {
    private final PathPolicy policy = new PathPolicy();

    @TempDir
    Path temporary;

    @Test
    void normalizesPortableRelativePath() {
        assertEquals("作者/书名.epub", policy.normalizeRelative(" 作者\\书名.epub "));
        assertEquals("作者/é.epub", policy.normalizeRelative("作者/e\u0301.epub"));
    }

    @Test
    void rejectsTraversalAbsoluteReservedAndInternalPaths() {
        assertThrows(ApiException.class, () -> policy.normalizeRelative("../outside.epub"));
        assertThrows(ApiException.class, () -> policy.normalizeRelative("/etc/passwd"));
        assertThrows(ApiException.class, () -> policy.normalizeRelative("CON.pdf"));
        assertThrows(ApiException.class, () -> policy.normalizeRelative(".bookkin-trash/book.epub"));
    }

    @Test
    void rejectsSymlinkEscapeForExistingSourceAndTargetParent() throws Exception {
        Path root = Files.createDirectory(temporary.resolve("root"));
        Path outside = Files.createDirectory(temporary.resolve("outside"));
        Files.writeString(outside.resolve("book.epub"), "outside");
        Files.createSymbolicLink(root.resolve("escape"), outside);

        assertThrows(ApiException.class, () -> policy.resolveExisting(root, "escape/book.epub"));
        assertThrows(ApiException.class, () -> policy.resolveTarget(root, "escape/new.epub"));
    }

    @Test
    void resolvesTargetUnderCanonicalRoot() throws Exception {
        Path root = Files.createDirectory(temporary.resolve("root"));
        Files.createDirectory(root.resolve("author"));
        Path target = policy.resolveTarget(root, "author/book.epub");
        assertTrue(target.startsWith(root.toRealPath()));
    }
}
