package com.elexvx.bookkin.filemanagement.infrastructure;

import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.filemanagement.FileInspector;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.zip.ZipFile;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

// 有界只读文本采样，不执行 OCR，也不修改 NAS 原文件。
/** Bounded, read-only text samples; no OCR and no changes to NAS originals. */
@Component
public class BookTextSampler {
    private static final int MAX_SECTIONS = 12;
    private static final int SECTION_CHARACTERS = 1800;
    private static final int MAX_XML_BYTES = 2 * 1024 * 1024;

    public Sample sample(Path path, BookFormat format) throws Exception {
        return format == BookFormat.PDF ? pdf(path) : epub(path);
    }

    private Sample pdf(Path path) throws IOException {
        try (var document = Loader.loadPDF(path.toFile())) {
            if (document.isEncrypted()) throw new IOException("加密 PDF 不支持知识点提取");
            var passages = new ArrayList<Passage>();
            var stripper = new PDFTextStripper();
            int count = document.getNumberOfPages();
            for (int index : indexes(count)) {
                stripper.setStartPage(index + 1);
                stripper.setEndPage(index + 1);
                String text = normalize(stripper.getText(document));
                if (!text.isBlank()) passages.add(new Passage("page:" + (index + 1), limit(text)));
            }
            return new Sample(passages, count);
        }
    }

    private Sample epub(Path path) throws Exception {
        try (var zip = new ZipFile(path.toFile(), StandardCharsets.UTF_8)) {
            var container = xml(zip, "META-INF/container.xml");
            var rootfiles = container.getElementsByTagNameNS("*", "rootfile");
            if (rootfiles.getLength() == 0) throw new IOException("EPUB 缺少正文声明");
            String opf = entryName(((Element) rootfiles.item(0)).getAttribute("full-path"));
            var document = xml(zip, opf);
            var manifest = new LinkedHashMap<String, String>();
            var items = document.getElementsByTagNameNS("*", "item");
            for (int i = 0; i < items.getLength(); i++) {
                var item = (Element) items.item(i);
                if (item.getAttribute("media-type").equals("application/xhtml+xml") && !item.getAttribute("properties").contains("nav")) {
                    manifest.put(item.getAttribute("id"), item.getAttribute("href"));
                }
            }
            var spine = new ArrayList<String>();
            var refs = document.getElementsByTagNameNS("*", "itemref");
            for (int i = 0; i < refs.getLength(); i++) {
                String href = manifest.get(((Element) refs.item(i)).getAttribute("idref"));
                if (href != null) spine.add(href);
            }
            var passages = new ArrayList<Passage>();
            Path base = Path.of(opf).getParent();
            for (int index : indexes(spine.size())) {
                String href = spine.get(index).split("#", 2)[0];
                String decoded = java.net.URLDecoder.decode(href.replace("+", "%2B"), StandardCharsets.UTF_8);
                String entry = entryName((base == null ? Path.of(decoded) : base.resolve(decoded)).normalize().toString());
                var chapter = xml(zip, entry);
                // 正文内出现的脚本和样式内容也忽略。
                // Ignore executable/style content even when it occurs inside the body.
                for (String tag : List.of("script", "style")) {
                    var elements = chapter.getElementsByTagNameNS("*", tag);
                    while (elements.getLength() > 0) elements.item(0).getParentNode().removeChild(elements.item(0));
                }
                var bodies = chapter.getElementsByTagNameNS("*", "body");
                if (bodies.getLength() == 0) continue;
                String text = normalize(bodies.item(0).getTextContent());
                if (!text.isBlank()) passages.add(new Passage(entry, limit(text)));
            }
            return new Sample(passages, spine.size());
        }
    }

    private Document xml(ZipFile zip, String name) throws Exception {
        var entry = zip.getEntry(entryName(name));
        if (entry == null || entry.isDirectory()) throw new IOException("EPUB 正文缺失");
        try (var input = zip.getInputStream(entry)) {
            byte[] bytes = input.readNBytes(MAX_XML_BYTES + 1);
            if (bytes.length > MAX_XML_BYTES) throw new IOException("EPUB 章节超过提取安全限制");
            var factory = FileInspector.secureXmlFactory();
            // EPUB 2 可能声明 XHTML 公共 DTD，但这里不加载 DTD 或展开实体。
            // EPUB 2 chapters may declare XHTML's public DTD; never load it or expand entities.
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", false);
            factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            var document = factory.newDocumentBuilder().parse(new ByteArrayInputStream(bytes));
            if (document.getDoctype() != null && document.getDoctype().getInternalSubset() != null
                    && !document.getDoctype().getInternalSubset().isBlank()) throw new IOException("EPUB 章节禁止自定义实体");
            return document;
        }
    }

    private static String entryName(String value) throws IOException {
        Path path = Path.of(value);
        if (path.isAbsolute() || path.normalize().startsWith("..") || value.contains("\\") || value.contains(":")) throw new IOException("EPUB 路径无效");
        return path.normalize().toString().replace('\\', '/');
    }

    static List<Integer> indexes(int count) {
        var result = new ArrayList<Integer>();
        int samples = Math.min(MAX_SECTIONS, count);
        for (int i = 0; i < samples; i++) result.add(samples == 1 ? 0 : (int) ((long) i * (count - 1) / (samples - 1)));
        return result;
    }

    public static String normalize(String text) { return text.replaceAll("\\s+", " ").strip(); }
    private String limit(String text) { return text.substring(0, Math.min(text.length(), SECTION_CHARACTERS)); }
    public record Passage(String locator, String text) {}
    public record Sample(List<Passage> passages, int totalSections) {}
}
