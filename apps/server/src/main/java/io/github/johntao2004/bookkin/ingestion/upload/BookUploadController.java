package io.github.johntao2004.bookkin.ingestion.upload;

import static io.github.johntao2004.bookkin.ingestion.upload.BookUploadModels.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.io.IOException;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("api")
@RequestMapping("/api/v1/book-uploads")
@PreAuthorize("hasAnyRole('OWNER','ADMIN')")
public class BookUploadController {
    private final BookUploadService service;

    public BookUploadController(BookUploadService service) { this.service = service; }

    @PostMapping
    BookUpload create(@Valid @RequestBody CreateUpload input, Principal principal) {
        return service.create(input.libraryRootId(), input.filename(), input.sizeBytes(), principal);
    }

    @PutMapping(path = "/{id}/content", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    BookUpload content(@PathVariable UUID id, HttpServletRequest request, Principal principal) throws IOException {
        return service.receive(id, request.getContentLengthLong(), request.getInputStream(), principal);
    }

    @GetMapping
    UploadList list(Principal principal) { return new UploadList(service.list(principal)); }

    @GetMapping("/{id}")
    BookUpload get(@PathVariable UUID id, Principal principal) { return service.get(id, principal); }

    @PatchMapping("/{id}/metadata")
    BookUpload metadata(@PathVariable UUID id, @Valid @RequestBody MetadataDraft input, Principal principal) {
        return service.updateDraft(id, input, principal);
    }

    @PostMapping("/{id}/enrich")
    BookUpload enrich(@PathVariable UUID id, Principal principal) { return service.enrich(id, principal); }

    @PutMapping(path = "/{id}/cover", consumes = {MediaType.IMAGE_JPEG_VALUE, MediaType.IMAGE_PNG_VALUE, "image/webp", MediaType.APPLICATION_OCTET_STREAM_VALUE})
    BookUpload cover(@PathVariable UUID id, @RequestBody byte[] bytes, Principal principal) { return service.customCover(id, bytes, principal); }

    @PostMapping("/{id}/cover-selection")
    BookUpload selectCover(@PathVariable UUID id, @Valid @RequestBody CoverSelection input, Principal principal) {
        return service.selectCover(id, input.candidateId(), principal);
    }

    @GetMapping("/{id}/cover")
    ResponseEntity<FileSystemResource> cover(@PathVariable UUID id, Principal principal) {
        var location = service.cover(id, principal);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(location.mimeType()))
                .cacheControl(CacheControl.noCache()).body(new FileSystemResource(location.path()));
    }

    @PostMapping("/{id}/commit")
    BookUpload commit(@PathVariable UUID id, @RequestHeader("Idempotency-Key") String idempotencyKey,
                      @Valid @RequestBody(required = false) CommitRequest input, Principal principal) {
        return service.commit(id, idempotencyKey, input != null && input.publishToDisplay(), principal);
    }

    @DeleteMapping("/{id}")
    void cancel(@PathVariable UUID id, Principal principal) { service.cancel(id, principal); }

    public record CreateUpload(@NotNull UUID libraryRootId, @NotBlank String filename, @Positive long sizeBytes) {}
    public record CoverSelection(@NotBlank String candidateId) {}
    public record CommitRequest(boolean publishToDisplay) {}
    public record UploadList(List<BookUpload> items) {}
}
