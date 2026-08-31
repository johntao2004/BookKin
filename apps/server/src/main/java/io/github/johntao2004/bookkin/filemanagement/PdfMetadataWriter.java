package io.github.johntao2004.bookkin.filemanagement;

import io.github.johntao2004.bookkin.catalog.BookMetadataRepository.BookMetadata;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.stream.Collectors;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.common.PDMetadata;
import org.springframework.stereotype.Component;

@Component
public class PdfMetadataWriter {
    public void write(Path source, Path target, BookMetadata metadata) throws IOException {
        try (var document = Loader.loadPDF(source.toFile())) {
            if (document.isEncrypted()) throw new IOException("加密 PDF 禁止写回");
            if (!document.getSignatureDictionaries().isEmpty()) throw new IOException("带数字签名的 PDF 禁止写回");
            var info = document.getDocumentInformation();
            info.setTitle(metadata.title());
            info.setAuthor(metadata.author());
            info.setSubject(metadata.description());
            info.setKeywords(metadata.tags() == null ? null : String.join(", ", metadata.tags()));
            document.setDocumentInformation(info);

            PDMetadata xmp = new PDMetadata(document);
            xmp.importXMPMetadata(xmp(metadata).getBytes(StandardCharsets.UTF_8));
            document.getDocumentCatalog().setMetadata(xmp);
            document.save(target.toFile());
        }
    }

    private String xmp(BookMetadata metadata) {
        String creators = metadata.author() == null ? "" : "<rdf:li>" + xml(metadata.author()) + "</rdf:li>";
        String subjects = metadata.tags() == null ? "" : metadata.tags().stream()
                .map(value -> "<rdf:li>" + xml(value) + "</rdf:li>").collect(Collectors.joining());
        return """
                <?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
                <x:xmpmeta xmlns:x="adobe:ns:meta/">
                  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
                    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
                      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">%s</rdf:li></rdf:Alt></dc:title>
                      <dc:creator><rdf:Seq>%s</rdf:Seq></dc:creator>
                      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">%s</rdf:li></rdf:Alt></dc:description>
                      <dc:subject><rdf:Bag>%s</rdf:Bag></dc:subject>
                    </rdf:Description>
                  </rdf:RDF>
                </x:xmpmeta>
                <?xpacket end="w"?>
                """.formatted(xml(metadata.title()), creators, xml(metadata.description()), subjects);
    }

    private String xml(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }
}
