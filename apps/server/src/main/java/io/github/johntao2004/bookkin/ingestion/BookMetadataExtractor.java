package io.github.johntao2004.bookkin.ingestion;

import io.github.johntao2004.bookkin.catalog.BookFormat;
import io.github.johntao2004.bookkin.filemanagement.FileInspector;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.xmpbox.xml.DomXmpParser;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

@Component
public class BookMetadataExtractor {
    private static final int MAX_XML_BYTES = 5 * 1024 * 1024;
    private static final int MAX_COVER_BYTES = 25 * 1024 * 1024;
    private static final long MAX_TEXT_BYTES = 100L * 1024 * 1024;

    public ExtractedBook extract(Path file, BookFormat format, Path root, String cacheKey) throws IOException {
        ExtractedBook extracted = switch (format) {
            case EPUB -> epub(file, root, cacheKey);
            case PDF -> pdf(file, root, cacheKey);
        };
        if (extracted.coverCacheKey() != null) return extracted;
        String generated = generateCover(root, cacheKey, extracted.title(), extracted.author());
        return new ExtractedBook(extracted.title(), extracted.subtitle(), extracted.authors(), extracted.translators(),
                extracted.description(), extracted.language(), extracted.publisher(), extracted.publishedDate(),
                extracted.isbn(), extracted.series(), extracted.seriesIndex(), extracted.tags(), generated,
                extracted.pageCount(), extracted.wordCount());
    }

    private ExtractedBook epub(Path file, Path root, String cacheKey) throws IOException {
        try (ZipFile zip = new ZipFile(file.toFile(), StandardCharsets.UTF_8)) {
            String opfPath = packagePath(zip);
            Document document = parseLimited(zip.getInputStream(zip.getEntry(opfPath)));
            Element metadata = (Element) document.getElementsByTagNameNS("*", "metadata").item(0);
            CreatorGroups contributors = contributors(metadata);
            String title = firstNonBlank(text(metadata, "title"), filenameTitle(file));
            String subtitle = refinedValue(metadata, "title-type", "subtitle", "title");
            String description = text(metadata, "description");
            String language = text(metadata, "language");
            String publisher = text(metadata, "publisher");
            String published = text(metadata, "date");
            String isbn = isbn(metadata);
            List<String> tags = texts(metadata, "subject");
            String series = firstNonBlank(metaContent(metadata, "calibre:series"), collection(metadata));
            BigDecimal seriesIndex = decimal(firstNonBlank(metaContent(metadata, "calibre:series_index"), refinedMeta(metadata, "group-position")));
            String cover = extractEpubCover(zip, document, opfPath, root, cacheKey);
            return new ExtractedBook(title, subtitle, contributors.authors(), contributors.translators(), description,
                    language, publisher, published, isbn, series, seriesIndex, tags, cover, null, countEpubWords(zip));
        } catch (IOException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IOException("EPUB 元数据提取失败", exception);
        }
    }

    private ExtractedBook pdf(Path file, Path root, String cacheKey) throws IOException {
        try (var document = Loader.loadPDF(file.toFile())) {
            var info = document.getDocumentInformation();
            String title = info.getTitle();
            List<String> authors = splitContributors(info.getAuthor());
            String description = info.getSubject();
            String language = null;
            String publisher = null;
            String published = null;
            String isbn = null;
            List<String> tags = splitTags(info.getKeywords());
            try {
                var pdMetadata = document.getDocumentCatalog().getMetadata();
                if (pdMetadata != null) {
                    try (InputStream input = pdMetadata.exportXMPMetadata()) {
                        var xmp = new DomXmpParser().parse(input);
                        var dc = xmp.getDublinCoreSchema();
                        if (dc != null) {
                            title = firstNonBlank(dc.getTitle(), title);
                            if (dc.getCreators() != null && !dc.getCreators().isEmpty()) authors = dc.getCreators();
                            description = firstNonBlank(dc.getDescription(), description);
                            language = first(dc.getLanguages());
                            publisher = first(dc.getPublishers());
                            isbn = firstNonBlank(dc.getIdentifier(), isbn);
                            if (dc.getSubjects() != null && !dc.getSubjects().isEmpty()) tags = dc.getSubjects();
                            if (dc.getDates() != null && !dc.getDates().isEmpty()) published = dc.getDates().getFirst().toInstant().toString();
                        }
                    }
                }
            } catch (Exception ignored) {
                // Invalid XMP must not hide valid Document Info metadata.
            }
            String cover = null;
            if (document.getNumberOfPages() > 0) {
                BufferedImage image = new PDFRenderer(document).renderImageWithDPI(0, 120, ImageType.RGB);
                Path target = coverPath(root, cacheKey, "jpg");
                Files.createDirectories(target.getParent());
                ImageIO.write(image, "JPEG", target.toFile());
                cover = relative(root, target);
            }
            return new ExtractedBook(firstNonBlank(title, filenameTitle(file)), null, authors, List.of(), description,
                    language, publisher, published, isbn, null, null, tags, cover, document.getNumberOfPages(), null);
        }
    }

    private CreatorGroups contributors(Element metadata) {
        if (metadata == null) return new CreatorGroups(List.of(), List.of());
        Map<String, String> roles = new HashMap<>();
        var metaNodes = metadata.getElementsByTagNameNS("*", "meta");
        for (int index = 0; index < metaNodes.getLength(); index++) {
            Element meta = (Element) metaNodes.item(index);
            if ("role".equals(meta.getAttribute("property")) && meta.getAttribute("refines").startsWith("#")) {
                roles.put(meta.getAttribute("refines").substring(1), meta.getTextContent().strip().toLowerCase(Locale.ROOT));
            }
        }
        List<String> authors = new ArrayList<>();
        List<String> translators = new ArrayList<>();
        var nodes = metadata.getElementsByTagNameNS("*", "creator");
        for (int index = 0; index < nodes.getLength(); index++) {
            Element creator = (Element) nodes.item(index);
            String value = creator.getTextContent().strip();
            String role = roles.getOrDefault(creator.getAttribute("id"), creator.getAttributeNS("http://www.idpf.org/2007/opf", "role"));
            if ("trl".equalsIgnoreCase(role) || "translator".equalsIgnoreCase(role)) translators.add(value);
            else authors.add(value);
        }
        var contributorNodes = metadata.getElementsByTagNameNS("*", "contributor");
        for (int index = 0; index < contributorNodes.getLength(); index++) {
            Element contributor = (Element) contributorNodes.item(index);
            String role = roles.getOrDefault(contributor.getAttribute("id"), contributor.getAttributeNS("http://www.idpf.org/2007/opf", "role"));
            if ("trl".equalsIgnoreCase(role) || "translator".equalsIgnoreCase(role)) translators.add(contributor.getTextContent().strip());
        }
        return new CreatorGroups(authors, translators);
    }

    private String isbn(Element metadata) {
        if (metadata == null) return null;
        var nodes = metadata.getElementsByTagNameNS("*", "identifier");
        for (int index = 0; index < nodes.getLength(); index++) {
            Element element = (Element) nodes.item(index);
            String raw = element.getTextContent().strip();
            String compact = raw.replaceAll("(?i)^urn:isbn:", "").replaceAll("[-\\s]", "");
            String scheme = element.getAttributeNS("http://www.idpf.org/2007/opf", "scheme");
            if ("isbn".equalsIgnoreCase(scheme) || compact.matches("(?:[0-9]{9}[0-9Xx]|[0-9]{13})")) return compact;
        }
        return null;
    }

    private String collection(Element metadata) {
        if (metadata == null) return null;
        var nodes = metadata.getElementsByTagNameNS("*", "meta");
        for (int index = 0; index < nodes.getLength(); index++) {
            Element element = (Element) nodes.item(index);
            if ("belongs-to-collection".equals(element.getAttribute("property"))) return element.getTextContent().strip();
        }
        return null;
    }

    private String refinedMeta(Element metadata, String property) {
        if (metadata == null) return null;
        var nodes = metadata.getElementsByTagNameNS("*", "meta");
        for (int index = 0; index < nodes.getLength(); index++) {
            Element element = (Element) nodes.item(index);
            if (property.equals(element.getAttribute("property"))) return element.getTextContent().strip();
        }
        return null;
    }

    private String refinedValue(Element metadata, String property, String expected, String targetElement) {
        if (metadata == null) return null;
        var metaNodes = metadata.getElementsByTagNameNS("*", "meta");
        for (int index = 0; index < metaNodes.getLength(); index++) {
            Element meta = (Element) metaNodes.item(index);
            if (property.equals(meta.getAttribute("property")) && expected.equalsIgnoreCase(meta.getTextContent().strip())
                    && meta.getAttribute("refines").startsWith("#")) {
                String id = meta.getAttribute("refines").substring(1);
                var targets = metadata.getElementsByTagNameNS("*", targetElement);
                for (int target = 0; target < targets.getLength(); target++) {
                    Element element = (Element) targets.item(target);
                    if (id.equals(element.getAttribute("id"))) return element.getTextContent().strip();
                }
            }
        }
        return null;
    }

    private long countEpubWords(ZipFile zip) throws IOException {
        long count = 0;
        long consumed = 0;
        var entries = zip.entries();
        while (entries.hasMoreElements() && consumed < MAX_TEXT_BYTES) {
            ZipEntry entry = entries.nextElement();
            String name = entry.getName().toLowerCase(Locale.ROOT);
            if (entry.isDirectory() || !(name.endsWith(".xhtml") || name.endsWith(".html") || name.endsWith(".htm"))) continue;
            int limit = (int) Math.min(MAX_XML_BYTES, MAX_TEXT_BYTES - consumed);
            try (InputStream input = zip.getInputStream(entry)) {
                byte[] bytes = input.readNBytes(limit);
                consumed += bytes.length;
                String text = new String(bytes, StandardCharsets.UTF_8).replaceAll("(?s)<script.*?</script>|<style.*?</style>|<[^>]+>", " ");
                boolean latinWord = false;
                for (int offset = 0; offset < text.length();) {
                    int codePoint = text.codePointAt(offset);
                    offset += Character.charCount(codePoint);
                    var script = Character.UnicodeScript.of(codePoint);
                    if (script == Character.UnicodeScript.HAN || script == Character.UnicodeScript.HIRAGANA || script == Character.UnicodeScript.KATAKANA) {
                        count++;
                        latinWord = false;
                    } else if (Character.isLetterOrDigit(codePoint)) {
                        if (!latinWord) count++;
                        latinWord = true;
                    } else latinWord = false;
                }
            }
        }
        return count;
    }

    private String generateCover(Path root, String cacheKey, String title, String author) throws IOException {
        BufferedImage image = new BufferedImage(800, 1200, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics.setColor(new Color(244, 237, 224));
        graphics.fillRect(0, 0, 800, 1200);
        graphics.setColor(new Color(196, 96, 68));
        graphics.fillRect(86, 94, 70, 8);
        graphics.setColor(new Color(39, 36, 31));
        graphics.setFont(new Font(Font.SERIF, Font.BOLD, 58));
        drawWrapped(graphics, title, 86, 270, 628, 78, 6);
        graphics.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 28));
        graphics.setColor(new Color(101, 94, 83));
        drawWrapped(graphics, author, 86, 1000, 628, 40, 2);
        graphics.dispose();
        Path target = coverPath(root, cacheKey, "jpg");
        Files.createDirectories(target.getParent());
        ImageIO.write(image, "JPEG", target.toFile());
        return relative(root, target);
    }

    private void drawWrapped(Graphics2D graphics, String value, int x, int y, int width, int lineHeight, int maxLines) {
        String text = value == null ? "未命名藏书" : value;
        StringBuilder line = new StringBuilder();
        int lineNumber = 0;
        for (int offset = 0; offset < text.length() && lineNumber < maxLines;) {
            int cp = text.codePointAt(offset);
            offset += Character.charCount(cp);
            String candidate = line + new String(Character.toChars(cp));
            if (graphics.getFontMetrics().stringWidth(candidate) > width && !line.isEmpty()) {
                graphics.drawString(line.toString(), x, y + lineNumber * lineHeight);
                lineNumber++;
                line.setLength(0);
            }
            line.appendCodePoint(cp);
        }
        if (!line.isEmpty() && lineNumber < maxLines) graphics.drawString(line.toString(), x, y + lineNumber * lineHeight);
    }

    private String packagePath(ZipFile zip) throws Exception {
        var entry = zip.getEntry("META-INF/container.xml");
        if (entry == null) throw new IOException("EPUB 缺少 container.xml");
        Document container = parseLimited(zip.getInputStream(entry));
        var nodes = container.getElementsByTagNameNS("*", "rootfile");
        if (nodes.getLength() == 0) throw new IOException("EPUB 缺少 OPF 声明");
        return ((Element) nodes.item(0)).getAttribute("full-path");
    }

    private String extractEpubCover(ZipFile zip, Document packageDocument, String opfPath, Path root, String cacheKey) throws IOException {
        String coverId = null;
        var metadataNodes = packageDocument.getElementsByTagNameNS("*", "meta");
        for (int index = 0; index < metadataNodes.getLength(); index++) {
            Element element = (Element) metadataNodes.item(index);
            if ("cover".equals(element.getAttribute("name"))) coverId = element.getAttribute("content");
        }
        Element coverItem = null;
        var items = packageDocument.getElementsByTagNameNS("*", "item");
        for (int index = 0; index < items.getLength(); index++) {
            Element item = (Element) items.item(index);
            if ((coverId != null && coverId.equals(item.getAttribute("id"))) || item.getAttribute("properties").contains("cover-image")) {
                coverItem = item;
                break;
            }
        }
        if (coverItem == null) return null;
        String href = coverItem.getAttribute("href");
        String base = opfPath.contains("/") ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : "";
        String entryName = URI.create(base + href).normalize().getPath();
        var entry = zip.getEntry(entryName);
        if (entry == null || entry.getSize() > MAX_COVER_BYTES) return null;
        String mediaType = coverItem.getAttribute("media-type");
        String extension = mediaType.contains("png") ? "png" : mediaType.contains("webp") ? "webp" : "jpg";
        Path target = coverPath(root, cacheKey, extension);
        Files.createDirectories(target.getParent());
        try (InputStream input = zip.getInputStream(entry)) {
            byte[] bytes = input.readNBytes(MAX_COVER_BYTES + 1);
            if (bytes.length > MAX_COVER_BYTES) throw new IOException("EPUB 封面超过安全限制");
            Files.write(target, bytes);
        }
        return relative(root, target);
    }

    private Path coverPath(Path root, String cacheKey, String extension) {
        return root.resolve(".bookkin-cache/covers/" + cacheKey.replace("sha256:", "") + "." + extension).normalize();
    }

    private String relative(Path root, Path target) {
        return root.relativize(target).toString().replace('\\', '/');
    }

    private Document parseLimited(InputStream input) throws Exception {
        try (input) {
            byte[] bytes = input.readNBytes(MAX_XML_BYTES + 1);
            if (bytes.length > MAX_XML_BYTES) throw new IOException("XML 元数据超过安全限制");
            return FileInspector.secureXmlFactory().newDocumentBuilder().parse(new ByteArrayInputStream(bytes));
        }
    }

    private String text(Element parent, String localName) {
        if (parent == null) return null;
        var nodes = parent.getElementsByTagNameNS("*", localName);
        return nodes.getLength() == 0 ? null : nodes.item(0).getTextContent().strip();
    }

    private List<String> texts(Element parent, String localName) {
        if (parent == null) return List.of();
        var nodes = parent.getElementsByTagNameNS("*", localName);
        List<String> values = new ArrayList<>();
        for (int index = 0; index < nodes.getLength(); index++) values.add(nodes.item(index).getTextContent().strip());
        return values;
    }

    private String metaContent(Element metadata, String name) {
        if (metadata == null) return null;
        var nodes = metadata.getElementsByTagNameNS("*", "meta");
        for (int index = 0; index < nodes.getLength(); index++) {
            Element element = (Element) nodes.item(index);
            if (name.equals(element.getAttribute("name"))) return element.getAttribute("content");
        }
        return null;
    }

    private String filenameTitle(Path file) {
        String name = file.getFileName().toString();
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    private List<String> splitContributors(String value) {
        return value == null || value.isBlank() ? List.of() : List.of(value.split("\\s*(?:;|、|/|&)\\s*"));
    }

    private List<String> splitTags(String value) {
        return value == null || value.isBlank() ? List.of() : List.of(value.split("\\s*[,;，；]\\s*"));
    }

    private String first(List<String> values) {
        return values == null || values.isEmpty() ? null : values.getFirst();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value.strip();
        return null;
    }

    private BigDecimal decimal(String value) {
        try { return value == null || value.isBlank() ? null : new BigDecimal(value.strip()); }
        catch (NumberFormatException ignored) { return null; }
    }

    private record CreatorGroups(List<String> authors, List<String> translators) {}
}
