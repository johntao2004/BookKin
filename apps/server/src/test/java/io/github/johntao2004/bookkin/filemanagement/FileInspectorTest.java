package io.github.johntao2004.bookkin.filemanagement;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.johntao2004.bookkin.catalog.BookFormat;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FileInspectorTest {
    @TempDir
    Path temporary;

    @Test
    void identifiesSignedAndEncryptedEpub() throws Exception {
        Path epub = temporary.resolve("protected.epub");
        try (ZipOutputStream output = new ZipOutputStream(Files.newOutputStream(epub))) {
            stored(output, "mimetype", "application/epub+zip");
            entry(output, "META-INF/container.xml", "<container xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\"><rootfiles><rootfile full-path=\"book.opf\"/></rootfiles></container>");
            entry(output, "META-INF/signatures.xml", "<signatures/>");
            entry(output, "META-INF/encryption.xml", "<encryption/>");
            entry(output, "book.opf", "<package/>");
        }
        var inspection = new FileInspector().inspect(epub, BookFormat.EPUB);
        assertTrue(inspection.parseable());
        assertTrue(inspection.encrypted());
        assertTrue(inspection.digitallySigned());
        assertFalse(inspection.drmProtected());
    }

    @Test
    void rejectsOversizedContainerXmlWithoutExpandingItInTheParser() throws Exception {
        Path epub = temporary.resolve("oversized-container.epub");
        try (ZipOutputStream output = new ZipOutputStream(Files.newOutputStream(epub))) {
            stored(output, "mimetype", "application/epub+zip");
            entry(output, "META-INF/container.xml", "x".repeat(5 * 1024 * 1024 + 1));
        }
        var inspection = new FileInspector().inspect(epub, BookFormat.EPUB);
        assertFalse(inspection.parseable());
    }

    private void entry(ZipOutputStream output, String name, String value) throws Exception {
        output.putNextEntry(new ZipEntry(name));
        output.write(value.getBytes(StandardCharsets.UTF_8));
        output.closeEntry();
    }

    private void stored(ZipOutputStream output, String name, String value) throws Exception {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        CRC32 crc = new CRC32();
        crc.update(bytes);
        ZipEntry entry = new ZipEntry(name);
        entry.setMethod(ZipEntry.STORED);
        entry.setSize(bytes.length);
        entry.setCompressedSize(bytes.length);
        entry.setCrc(crc.getValue());
        output.putNextEntry(entry);
        output.write(bytes);
        output.closeEntry();
    }
}
