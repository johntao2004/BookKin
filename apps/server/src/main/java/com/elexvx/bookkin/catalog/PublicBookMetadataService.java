package com.elexvx.bookkin.catalog;

import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.infrastructure.BookBibliographyReader;
import com.elexvx.bookkin.filemanagement.infrastructure.KnowledgeTextGateway;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** Public bibliography projection; never exposes storage identifiers or personal reading data. */
@Service
public class PublicBookMetadataService {
    private static final Set<String> SOURCE_FIELDS = Set.of("title", "subtitle", "authors", "translators",
            "language", "publisher", "publishedDate", "isbn", "description", "series", "seriesIndex",
            "tags", "subjectCodes", "authorBiography", "tableOfContents");
    private static final Set<String> SOURCE_VALUES = Set.of("FILE", "FILENAME", "OPEN_LIBRARY", "WIKIDATA",
            "GOOGLE_BOOKS", "AI", "MANUAL");
    private final DisplayCatalogService display;
    private final BookMetadataRepository metadata;
    private final BookRepository books;
    private final KnowledgeTextGateway source;

    public PublicBookMetadataService(DisplayCatalogService display, BookMetadataRepository metadata,
                                     BookRepository books, KnowledgeTextGateway source) {
        this.display = display;
        this.metadata = metadata;
        this.books = books;
        this.source = source;
    }

    public PublicMetadata metadata(UUID bookId) {
        var publicBook = display.findPublic(bookId);
        var value = metadata.find(bookId).orElseThrow(() -> ApiException.notFound("BOOK_NOT_FOUND", "未找到这本书。"));
        var publicSources = new LinkedHashMap<String, String>();
        value.sources().forEach((field, origin) -> {
            if (field != null && origin != null && SOURCE_FIELDS.contains(field) && SOURCE_VALUES.contains(origin)) {
                publicSources.put(field, origin);
            }
        });
        return new PublicMetadata(value.id(), value.title(), value.subtitle(), value.authors(), value.translators(),
                value.language(), value.publisher(), value.publishedDate(), value.isbn(), value.description(),
                value.series(), value.seriesIndex(), value.tags(), value.subjectCodes(), publicBook.coverUrl(),
                Map.copyOf(publicSources), value.authorBiography(), value.tableOfContents(), value.knowledgeTerms());
    }

    public BookBibliographyReader.Source bibliography(UUID bookId) throws Exception {
        display.findPublic(bookId);
        var file = books.findPreferredFile(bookId).orElseThrow(() -> ApiException.notFound("BOOK_FILE_NOT_FOUND", "书籍文件不可用。"));
        // The shared gateway enforces managed roots, read leases and before/after fingerprints.
        return source.bibliography(file);
    }

    public record PublicMetadata(UUID id, String title, String subtitle, List<String> authors, List<String> translators,
                                 String language, String publisher, String publishedDate, String isbn, String description,
                                 String series, BigDecimal seriesIndex, List<String> tags, List<String> subjectCodes,
                                 String coverUrl, Map<String, String> sources, String authorBiography,
                                 String tableOfContents, List<String> knowledgeTerms) {}
}
