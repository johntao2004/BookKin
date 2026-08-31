package io.github.johntao2004.bookkin.filemanagement;

import io.github.johntao2004.bookkin.catalog.BookMetadataRepository.BookMetadata;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;
import javax.xml.XMLConstants;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

@Component
public class EpubMetadataWriter {
    private static final String DC = "http://purl.org/dc/elements/1.1/";
    private static final long MAX_COVER_BYTES = 20L * 1024 * 1024;

    public void write(Path source, Path target, BookMetadata metadata, Path libraryRoot) throws IOException {
        try (ZipFile zip = new ZipFile(source.toFile(), StandardCharsets.UTF_8);
             ZipOutputStream output = new ZipOutputStream(Files.newOutputStream(target), StandardCharsets.UTF_8)) {
            String opfPath = findPackagePath(zip);
            CoverReplacement cover = coverReplacement(zip, opfPath, metadata, libraryRoot);
            writeMimetypeFirst(zip, output);
            var entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry original = entries.nextElement();
                if (original.getName().equals("mimetype")) continue;
                ZipEntry next = new ZipEntry(original.getName());
                next.setTime(original.getTime());
                if (original.isDirectory()) {
                    output.putNextEntry(next);
                    output.closeEntry();
                    continue;
                }
                output.putNextEntry(next);
                if (original.getName().equals(opfPath)) {
                    try (InputStream input = zip.getInputStream(original)) {
                        output.write(updatePackage(input, metadata));
                    }
                } else if (cover != null && original.getName().equals(cover.entryName())) {
                    output.write(cover.bytes());
                } else {
                    try (InputStream input = zip.getInputStream(original)) {
                        input.transferTo(output);
                    }
                }
                output.closeEntry();
            }
        }
    }

    private CoverReplacement coverReplacement(ZipFile zip, String opfPath, BookMetadata metadata, Path libraryRoot)
            throws IOException {
        if (metadata.coverCacheKey() == null || metadata.coverCacheKey().isBlank()) return null;
        String entryName = findCoverEntry(zip, opfPath);
        if (entryName == null || zip.getEntry(entryName) == null) return null;
        Path canonicalRoot = libraryRoot.toRealPath();
        Path candidate = canonicalRoot.resolve(metadata.coverCacheKey()).normalize();
        if (!candidate.startsWith(canonicalRoot) || Files.isSymbolicLink(candidate)
                || !Files.isRegularFile(candidate, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException("EPUB 封面缓存路径不安全或不存在");
        }
        Path real = candidate.toRealPath();
        if (!real.startsWith(canonicalRoot) || Files.size(real) > MAX_COVER_BYTES) {
            throw new IOException("EPUB 封面缓存越界或过大");
        }
        return new CoverReplacement(entryName, Files.readAllBytes(real));
    }

    private String findCoverEntry(ZipFile zip, String opfPath) throws IOException {
        var opf = zip.getEntry(opfPath);
        if (opf == null) throw new IOException("EPUB 缺少 OPF 文件");
        try (InputStream input = zip.getInputStream(opf)) {
            Document document = FileInspector.secureXmlFactory().newDocumentBuilder().parse(input);
            String coverId = null;
            var metadataNodes = document.getElementsByTagNameNS("*", "meta");
            for (int index = 0; index < metadataNodes.getLength(); index++) {
                Element element = (Element) metadataNodes.item(index);
                if ("cover".equals(element.getAttribute("name"))) coverId = element.getAttribute("content");
            }
            var items = document.getElementsByTagNameNS("*", "item");
            for (int index = 0; index < items.getLength(); index++) {
                Element item = (Element) items.item(index);
                if ((coverId != null && coverId.equals(item.getAttribute("id")))
                        || item.getAttribute("properties").contains("cover-image")) {
                    String base = opfPath.contains("/") ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : "";
                    return URI.create(base + item.getAttribute("href")).normalize().getPath();
                }
            }
            return null;
        } catch (IOException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IOException("无法定位 EPUB 封面", exception);
        }
    }

    private String findPackagePath(ZipFile zip) throws IOException {
        var container = zip.getEntry("META-INF/container.xml");
        if (container == null) throw new IOException("EPUB 缺少 container.xml");
        try (InputStream input = zip.getInputStream(container)) {
            Document document = FileInspector.secureXmlFactory().newDocumentBuilder().parse(input);
            var rootfiles = document.getElementsByTagNameNS("*", "rootfile");
            if (rootfiles.getLength() == 0) throw new IOException("EPUB 未声明 OPF 文件");
            return ((Element) rootfiles.item(0)).getAttribute("full-path");
        } catch (IOException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IOException("无法读取 EPUB 包结构", exception);
        }
    }

    private void writeMimetypeFirst(ZipFile zip, ZipOutputStream output) throws IOException {
        var entry = zip.getEntry("mimetype");
        if (entry == null) throw new IOException("EPUB 缺少 mimetype");
        byte[] bytes;
        try (InputStream input = zip.getInputStream(entry)) {
            bytes = input.readAllBytes();
        }
        CRC32 crc = new CRC32();
        crc.update(bytes);
        ZipEntry stored = new ZipEntry("mimetype");
        stored.setMethod(ZipEntry.STORED);
        stored.setSize(bytes.length);
        stored.setCompressedSize(bytes.length);
        stored.setCrc(crc.getValue());
        output.putNextEntry(stored);
        output.write(bytes);
        output.closeEntry();
    }

    private byte[] updatePackage(InputStream input, BookMetadata metadata) throws IOException {
        try {
            Document document = FileInspector.secureXmlFactory().newDocumentBuilder().parse(input);
            Element metadataElement = (Element) document.getElementsByTagNameNS("*", "metadata").item(0);
            if (metadataElement == null) throw new IOException("EPUB OPF 缺少 metadata");
            setDc(document, metadataElement, "title", metadata.title());
            setDc(document, metadataElement, "creator", metadata.author());
            setDc(document, metadataElement, "language", metadata.language());
            setDc(document, metadataElement, "publisher", metadata.publisher());
            setDc(document, metadataElement, "description", metadata.description());
            setDc(document, metadataElement, "identifier", metadata.isbn());
            replaceSubjects(document, metadataElement, metadata.tags());
            setMeta(document, metadataElement, "calibre:series", metadata.series());

            TransformerFactory factory = TransformerFactory.newInstance();
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");
            var transformer = factory.newTransformer();
            transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
            transformer.setOutputProperty(OutputKeys.INDENT, "no");
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            transformer.transform(new DOMSource(document), new StreamResult(output));
            return output.toByteArray();
        } catch (IOException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IOException("无法更新 EPUB 元数据", exception);
        }
    }

    private void setDc(Document document, Element metadata, String localName, String value) {
        if (value == null || value.isBlank()) return;
        var nodes = metadata.getElementsByTagNameNS(DC, localName);
        Element element;
        if (nodes.getLength() > 0) element = (Element) nodes.item(0);
        else {
            element = document.createElementNS(DC, "dc:" + localName);
            metadata.appendChild(element);
        }
        element.setTextContent(value);
    }

    private void replaceSubjects(Document document, Element metadata, List<String> tags) {
        if (tags == null) return;
        var nodes = metadata.getElementsByTagNameNS(DC, "subject");
        List<Element> existing = new ArrayList<>();
        for (int index = 0; index < nodes.getLength(); index++) existing.add((Element) nodes.item(index));
        existing.forEach(metadata::removeChild);
        for (String tag : tags) {
            Element subject = document.createElementNS(DC, "dc:subject");
            subject.setTextContent(tag);
            metadata.appendChild(subject);
        }
    }

    private void setMeta(Document document, Element metadata, String name, String value) {
        if (value == null || value.isBlank()) return;
        var nodes = metadata.getElementsByTagNameNS("*", "meta");
        Element found = null;
        for (int index = 0; index < nodes.getLength(); index++) {
            Element candidate = (Element) nodes.item(index);
            if (name.equals(candidate.getAttribute("name"))) found = candidate;
        }
        if (found == null) {
            found = document.createElement("meta");
            found.setAttribute("name", name);
            metadata.appendChild(found);
        }
        found.setAttribute("content", value);
    }

    private record CoverReplacement(String entryName, byte[] bytes) {}
}
