package com.elexvx.bookkin.filemanagement.infrastructure;

import com.elexvx.bookkin.catalog.BookFormat;
import com.elexvx.bookkin.filemanagement.FileInspector;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipFile;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

// 只读书目资料网关，不读取私人笔记、不生成封面、不修改原文件。
/** Read-only source bibliography gateway: no private notes, cover generation or source writes. */
public class BookBibliographyReader {
    public record Source(String description, String authorBiography, String tableOfContents, List<String> subjectCodes) {}
    public Source read(Path path, BookFormat format) throws Exception {
        if (format == BookFormat.EPUB) {
            try (var zip = new ZipFile(path.toFile(), StandardCharsets.UTF_8)) {
                var container = parseLimited(zip.getInputStream(zip.getEntry("META-INF/container.xml")));
                String opf = ((Element) container.getElementsByTagNameNS("*", "rootfile").item(0)).getAttribute("full-path");
                var document = parseLimited(zip.getInputStream(zip.getEntry(opf)));
                var metadata = (Element) document.getElementsByTagNameNS("*", "metadata").item(0);
                var descriptions = metadata.getElementsByTagNameNS("*", "description");
                return new Source(descriptions.getLength() == 0 ? null : descriptions.item(0).getTextContent(),
                        metaContent(metadata, "bookkin:authorBiography"), firstNonBlank(metaContent(metadata, "bookkin:tableOfContents"), epubContents(zip, document, opf)), themaSubjects(metadata));
            }
        }
        try (var pdf = org.apache.pdfbox.Loader.loadPDF(path.toFile())) {
            if (pdf.isEncrypted()) throw new java.io.IOException("加密 PDF 不支持资料识别");
            var info = pdf.getDocumentInformation();
            String codes = info.getCustomMetadataValue("Thema");
            return new Source(info.getSubject(), info.getCustomMetadataValue("BookKinAuthorBiography"),
                    firstNonBlank(info.getCustomMetadataValue("BookKinTableOfContents"), pdfContents(pdf)),
                    com.elexvx.bookkin.catalog.ThemaSubjects.extract(codes == null ? List.of() : List.of(codes.split(","))));
        }
    }
    // 有界读取原文件目录，不推测作者生平，也不改写正文或阅读定位。
    /** Bounded source TOC extraction; never infer author biographies or alter text/reading locators. */
    public String epubContents(ZipFile zip, Document document, String opfPath) {
        var labels = new ArrayList<String>();
        try {
            var items = document.getElementsByTagNameNS("*", "item");
            Element toc = null;
            for (int i = 0; i < items.getLength(); i++) {
                var item = (Element) items.item(i);
                if (item.getAttribute("properties").contains("nav")) { toc = item; break; }
                if (item.getAttribute("media-type").equals("application/x-dtbncx+xml")) toc = item;
            }
            if (toc == null) return null;
            String href = java.net.URLDecoder.decode(toc.getAttribute("href").replace("+", "%2B"), StandardCharsets.UTF_8);
            Path base = Path.of(opfPath).getParent();
            Path name = (base == null ? Path.of(href) : base.resolve(href)).normalize();
            if (name.isAbsolute() || name.startsWith("..") || href.contains(":")) return null;
            var entry = zip.getEntry(name.toString().replace('\\', '/'));
            if (entry == null) return null;
            var nav = parseLimited(zip.getInputStream(entry));
            boolean ncx = toc.getAttribute("media-type").equals("application/x-dtbncx+xml");
            org.w3c.dom.Node scope = nav;
            if (!ncx) {
                var navs = nav.getElementsByTagNameNS("*", "nav");
                scope = null;
                for (int i = 0; i < navs.getLength(); i++) {
                    var element = (Element) navs.item(i);
                    if (element.getAttributeNS("http://www.idpf.org/2007/ops", "type").contains("toc")) { scope = element; break; }
                }
                if (scope == null) return null;
            }
            var nodes = scope instanceof Document d ? d.getElementsByTagNameNS("*", ncx ? "navLabel" : "a")
                    : ((Element) scope).getElementsByTagNameNS("*", "a");
            for (int i = 0; i < nodes.getLength() && labels.size() < 300; i++) {
                String label = nodes.item(i).getTextContent().replaceAll("\\s+", " ").strip();
                if (!label.isBlank()) labels.add(label.substring(0, Math.min(300, label.length())));
            }
        } catch (Exception ignored) { return null; }
        String text = String.join("\n", labels);
        return text.isBlank() ? null : text.substring(0, Math.min(text.length(), 40_000));
    }

    public String pdfContents(org.apache.pdfbox.pdmodel.PDDocument document) {
        var labels = new ArrayList<String>();
        var outline = document.getDocumentCatalog().getDocumentOutline();
        if (outline == null) return null;
        var queue = new java.util.ArrayDeque<org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem>();
        if (outline.getFirstChild() != null) queue.add(outline.getFirstChild());
        var visited = java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<org.apache.pdfbox.cos.COSDictionary, Boolean>());
        while (!queue.isEmpty() && labels.size() < 300 && visited.size() < 600) {
            var item = queue.removeFirst();
            if (!visited.add(item.getCOSObject())) continue;
            String title = item.getTitle();
            if (title != null && !title.isBlank()) labels.add(title.substring(0, Math.min(title.length(), 300)));
            if (item.getNextSibling() != null) queue.addFirst(item.getNextSibling());
            if (item.getFirstChild() != null) queue.addFirst(item.getFirstChild());
        }
        String text = String.join("\n", labels);
        return text.isBlank() ? null : text.substring(0, Math.min(text.length(), 40_000));
    }

    public List<String> themaSubjects(Element metadata) {
        if (metadata == null) return List.of();
        var result = new ArrayList<String>();
        var subjects = metadata.getElementsByTagNameNS("*", "subject");
        for (int i = 0; i < subjects.getLength(); i++) {
            var subject = (Element) subjects.item(i);
            String scheme = firstNonBlank(subject.getAttributeNS("http://www.idpf.org/2007/opf", "scheme"), subject.getAttribute("scheme"));
            if ("Thema".equalsIgnoreCase(scheme)) result.add(subject.getTextContent());
            String id = subject.getAttribute("id");
            if (!id.isBlank()) {
                var metas = metadata.getElementsByTagNameNS("*", "meta");
                boolean authority = false;
                String term = null;
                for (int m = 0; m < metas.getLength(); m++) {
                    var meta = (Element) metas.item(m);
                    if (!("#" + id).equals(meta.getAttribute("refines"))) continue;
                    if ("authority".equals(meta.getAttribute("property")) && "Thema".equalsIgnoreCase(meta.getTextContent().strip())) authority = true;
                    if ("term".equals(meta.getAttribute("property"))) term = meta.getTextContent();
                }
                if (authority) result.add(term == null ? subject.getTextContent() : term);
            }
        }
        return com.elexvx.bookkin.catalog.ThemaSubjects.extract(result);
    }


    private Document parseLimited(InputStream input) throws Exception {
        try (input) {
            byte[] bytes = input.readNBytes(2 * 1024 * 1024 + 1);
            if (bytes.length > 2 * 1024 * 1024) throw new java.io.IOException("书目 XML 超过安全限制");
            var factory = FileInspector.secureXmlFactory();
            // EPUB 2 的外部 DTD 声明可保留，但绝不加载 DTD 或接受自定义实体。
            /** EPUB 2 may declare an external DTD; never load it or accept custom entities. */
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", false);
            factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            var document = factory.newDocumentBuilder().parse(new ByteArrayInputStream(bytes));
            if (document.getDoctype() != null && document.getDoctype().getInternalSubset() != null
                    && !document.getDoctype().getInternalSubset().isBlank()) throw new java.io.IOException("书目 XML 禁止自定义实体");
            return document;
        }
    }
    private String metaContent(Element parent, String name) {
        var metas = parent.getElementsByTagNameNS("*", "meta");
        for (int i=0;i<metas.getLength();i++) { var meta=(Element)metas.item(i); if (name.equals(meta.getAttribute("name"))) return meta.getAttribute("content"); }
        return null;
    }
    private String firstNonBlank(String... values) { for (var value:values) if (value!=null&&!value.isBlank()) return value.strip(); return null; }
}
