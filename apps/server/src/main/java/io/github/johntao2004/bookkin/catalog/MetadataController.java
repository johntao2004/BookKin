package io.github.johntao2004.bookkin.catalog;

import io.github.johntao2004.bookkin.catalog.BookMetadataRepository.MetadataPatch;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.Preview;
import io.github.johntao2004.bookkin.filemanagement.FileOperationModels.PreviewRequest;
import io.github.johntao2004.bookkin.filemanagement.FileOperationService;
import io.github.johntao2004.bookkin.filemanagement.FileOperationType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.math.BigDecimal;
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
                input.seriesIndex(), input.tags(), input.manualFields()));
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
                                  String[] manualFields, boolean writeBack, UUID bookFileId, String expectedFingerprint) {
        public MetadataRequest {
            manualFields = manualFields == null ? new String[]{"title", "subtitle", "authors", "translators", "language", "publisher", "publishedDate", "isbn", "description", "series", "seriesIndex", "tags"} : manualFields;
        }
    }
    public record MetadataResult(BookMetadataRepository.BookMetadata metadata, Preview writeBackPreview) {}
}
