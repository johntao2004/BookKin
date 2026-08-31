package io.github.johntao2004.bookkin.filemanagement;

import io.github.johntao2004.bookkin.catalog.BookFormat;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Locale;
import java.util.zip.ZipFile;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.apache.pdfbox.Loader;
import org.springframework.stereotype.Component;

@Component
public class FileInspector {
    private static final int MAX_XML_BYTES = 5 * 1024 * 1024;
    private static final int MAX_EPUB_ENTRIES = 20_000;
    private static final long MAX_EPUB_UNCOMPRESSED_BYTES = 4L * 1024 * 1024 * 1024;

    public Inspection inspect(Path path, BookFormat format) throws IOException {
        return switch (format) {
            case EPUB -> inspectEpub(path);
            case PDF -> inspectPdf(path);
        };
    }

    public void assertReadable(Path path, BookFormat format) throws IOException {
        Inspection inspection = inspect(path, format);
        if (!inspection.parseable()) throw new IOException("文件无法被解析");
    }

    private Inspection inspectEpub(Path path) throws IOException {
        try (ZipFile zip = new ZipFile(path.toFile(), StandardCharsets.UTF_8)) {
            long declaredBytes = 0;
            int entries = 0;
            long compressedSize = Math.max(1, java.nio.file.Files.size(path));
            long ratioLimit = Math.max(256L * 1024 * 1024,
                    Math.min(MAX_EPUB_UNCOMPRESSED_BYTES, compressedSize > MAX_EPUB_UNCOMPRESSED_BYTES / 250
                            ? MAX_EPUB_UNCOMPRESSED_BYTES : compressedSize * 250));
            var enumeration = zip.entries();
            while (enumeration.hasMoreElements()) {
                var entry = enumeration.nextElement();
                entries++;
                if (entries > MAX_EPUB_ENTRIES) throw new IOException("EPUB 条目数量超过安全限制");
                if (entry.getSize() > 0) {
                    declaredBytes = Math.addExact(declaredBytes, entry.getSize());
                    if (declaredBytes > ratioLimit || declaredBytes > MAX_EPUB_UNCOMPRESSED_BYTES) {
                        throw new IOException("EPUB 解压大小超过安全限制");
                    }
                }
            }
            var mimetype = zip.getEntry("mimetype");
            var container = zip.getEntry("META-INF/container.xml");
            boolean parseable = mimetype != null && container != null;
            boolean signed = zip.getEntry("META-INF/signatures.xml") != null;
            boolean encrypted = zip.getEntry("META-INF/encryption.xml") != null;
            boolean drm = zip.stream().anyMatch(entry -> entry.getName().toLowerCase(Locale.ROOT).contains("rights.xml"));
            if (container != null) {
                try (var input = zip.getInputStream(container)) {
                    var factory = secureXmlFactory();
                    byte[] bytes = input.readNBytes(MAX_XML_BYTES + 1);
                    if (bytes.length > MAX_XML_BYTES) throw new IOException("EPUB container.xml 超过安全限制");
                    factory.newDocumentBuilder().parse(new ByteArrayInputStream(bytes));
                } catch (Exception exception) {
                    parseable = false;
                }
            }
            return new Inspection(parseable, encrypted, drm, signed);
        }
    }

    private Inspection inspectPdf(Path path) throws IOException {
        try (var document = Loader.loadPDF(path.toFile())) {
            return new Inspection(true, document.isEncrypted(), false, !document.getSignatureDictionaries().isEmpty());
        } catch (org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException exception) {
            return new Inspection(true, true, false, false);
        }
    }

    public static DocumentBuilderFactory secureXmlFactory() throws Exception {
        var factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        return factory;
    }

    public record Inspection(boolean parseable, boolean encrypted, boolean drmProtected, boolean digitallySigned) {}
}
