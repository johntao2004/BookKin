package io.github.johntao2004.bookkin.annotations;

import io.github.johntao2004.bookkin.annotations.AnnotationRepository.Annotation;
import io.github.johntao2004.bookkin.annotations.AnnotationRepository.AnnotationBookPage;
import io.github.johntao2004.bookkin.annotations.AnnotationRepository.AnnotationStyle;
import io.github.johntao2004.bookkin.annotations.AnnotationRepository.AnnotationType;
import io.github.johntao2004.bookkin.annotations.AnnotationExportService.ExportFormat;
import io.github.johntao2004.bookkin.catalog.BookRepository;
import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.users.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/annotations")
public class AnnotationController {
    private final AnnotationRepository annotations;
    private final UserRepository users;
    private final BookRepository books;
    private final AnnotationExportService exportService;

    public AnnotationController(AnnotationRepository annotations, UserRepository users, BookRepository books,
                                AnnotationExportService exportService) {
        this.annotations = annotations;
        this.users = users;
        this.books = books;
        this.exportService = exportService;
    }

    @GetMapping
    AnnotationList list(@RequestParam(required = false) UUID bookId, Principal principal) {
        return new AnnotationList(annotations.list(userId(principal), bookId));
    }

    @GetMapping("/books")
    AnnotationBookPage listBooks(@RequestParam(required = false) String q,
                                 @RequestParam(required = false) String cursor,
                                 @RequestParam(defaultValue = "36") int limit,
                                 Principal principal) {
        return annotations.listBooks(userId(principal), q, cursor, limit);
    }

    @GetMapping("/books/{bookId}/export/{format}")
    ResponseEntity<byte[]> export(@PathVariable UUID bookId, @PathVariable ExportFormat format, Principal principal) {
        var items = annotations.list(userId(principal), bookId).stream()
                .filter(annotation -> annotation.type() != AnnotationType.BOOKMARK).toList();
        if (items.isEmpty()) throw ApiException.notFound("ANNOTATIONS_NOT_FOUND", "这本书还没有可导出的笔记或划线。");
        var file = exportService.export(items.getFirst().bookTitle(), items.getFirst().bookAuthor(), items, format);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.mediaType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.filename(), StandardCharsets.UTF_8).build().toString())
                .contentLength(file.content().length)
                .body(file.content());
    }

    @PostMapping
    Annotation create(@Valid @RequestBody CreateAnnotation input, Principal principal) {
        books.findPreferredFile(input.bookId()).orElseThrow(() -> ApiException.notFound("BOOK_NOT_FOUND", "未找到这本书。"));
        return annotations.create(userId(principal), input.bookId(), input.type(), input.locator(), input.quote(),
                input.note(), input.style(), input.color());
    }

    @DeleteMapping("/{id}")
    void delete(@PathVariable UUID id, Principal principal) {
        annotations.delete(userId(principal), id);
    }

    private UUID userId(Principal principal) {
        return users.findByUsername(principal.getName()).orElseThrow().id();
    }

    public record CreateAnnotation(@NotNull UUID bookId, @NotNull AnnotationType type,
                                   @NotBlank @Size(max = 4000) String locator,
                                   @Size(max = 10_000) String quote,
                                   @Size(max = 20_000) String note,
                                   @NotNull AnnotationStyle style,
                                   @Size(max = 16) String color) {}
    public record AnnotationList(List<Annotation> items) {}
}
