package com.elexvx.bookkin.catalog;

import com.elexvx.bookkin.catalog.BookMetadataRepository.MetadataPatch;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.FileOperationModels.Preview;
import com.elexvx.bookkin.filemanagement.FileOperationModels.PreviewRequest;
import com.elexvx.bookkin.filemanagement.FileOperationService;
import com.elexvx.bookkin.filemanagement.FileOperationType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.http.MediaType;

@RestController
@Profile("api")
@RequestMapping("/api/v1/books")
@PreAuthorize("hasAnyRole('OWNER','ADMIN')")
public class MetadataController {
    private final BookMetadataRepository metadata;
    private final BookRepository books;
    private final FileOperationService fileOperations;
    private final BookCoverService covers;

    public MetadataController(BookMetadataRepository metadata, BookRepository books, FileOperationService fileOperations, BookCoverService covers) {
        this.metadata = metadata;
        this.books = books;
        this.fileOperations = fileOperations;
        this.covers = covers;
    }

    @GetMapping("/{id}/metadata")
    BookMetadataRepository.BookMetadata get(@PathVariable UUID id) {
        return metadata.find(id).orElseThrow(() -> ApiException.notFound("BOOK_NOT_FOUND", "未找到这本书。"));
    }

    @PatchMapping("/{id}/metadata")
    MetadataResult update(@PathVariable UUID id, @Valid @RequestBody MetadataRequest input, Principal principal) {
        metadata.find(id).orElseThrow(() -> ApiException.notFound("BOOK_NOT_FOUND", "未找到这本书。"));
        metadata.update(id, new MetadataPatch(input.title(), input.subtitle(), input.authors(), input.translators(),
                input.language(), input.publisher(), input.publishedDate(), input.isbn(), input.description(), input.series(),
                input.seriesIndex(), input.tags(), input.subjectCodes(), input.manualFields()));
        Preview preview = null;
        if (input.writeBack()) {
            var file = input.bookFileId() == null ? books.findPreferredFile(id).orElseThrow() : books.findFile(input.bookFileId()).orElseThrow();
            preview = fileOperations.preview(new PreviewRequest(file.id(), FileOperationType.WRITE_METADATA, null, null,
                    input.expectedFingerprint() == null ? file.fingerprint() : input.expectedFingerprint(), null,
                    null), principal);
        }
        return new MetadataResult(metadata.find(id).orElseThrow(), preview);
    }

    @PutMapping(path = "/{id}/cover", consumes = {MediaType.IMAGE_JPEG_VALUE, MediaType.IMAGE_PNG_VALUE, "image/webp", MediaType.APPLICATION_OCTET_STREAM_VALUE})
    void cover(@PathVariable UUID id, @RequestBody byte[] bytes, Principal principal) { covers.upload(id, bytes, principal); }

    @DeleteMapping("/{id}/cover")
    void resetCover(@PathVariable UUID id, Principal principal) { covers.reset(id, principal); }

    public record MetadataRequest(@Size(max = 500) String title, @Size(max = 500) String subtitle,
                                  List<@Size(max = 300) String> authors, List<@Size(max = 300) String> translators,
                                  @Size(max = 32) String language, @Size(max = 500) String publisher,
                                  @Size(max = 40) String publishedDate, @Size(max = 40) String isbn,
                                  @Size(max = 20_000) String description, @Size(max = 500) String series,
                                  BigDecimal seriesIndex, List<@Size(max = 200) String> tags,
                                  @Size(max = 4) List<@Size(max = 32) String> subjectCodes,
                                  String[] manualFields, boolean writeBack, UUID bookFileId, String expectedFingerprint) {
        public MetadataRequest {
            if (manualFields == null) {
                List<String> supplied = new ArrayList<>();
                if (title != null) supplied.add("title");
                if (subtitle != null) supplied.add("subtitle");
                if (authors != null) supplied.add("authors");
                if (translators != null) supplied.add("translators");
                if (language != null) supplied.add("language");
                if (publisher != null) supplied.add("publisher");
                if (publishedDate != null) supplied.add("publishedDate");
                if (isbn != null) supplied.add("isbn");
                if (description != null) supplied.add("description");
                if (series != null) supplied.add("series");
                if (seriesIndex != null) supplied.add("seriesIndex");
                if (tags != null) supplied.add("tags");
                if (subjectCodes != null) supplied.add("subjectCodes");
                manualFields = supplied.toArray(String[]::new);
            }
        }
    }
    public record MetadataResult(BookMetadataRepository.BookMetadata metadata, Preview writeBackPreview) {}
}
