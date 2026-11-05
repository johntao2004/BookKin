package com.elexvx.silvae.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.elexvx.silvae.auth.ApiPermissionPolicy;
import com.elexvx.silvae.common.ApiException;
import com.elexvx.silvae.common.ApiExceptionHandler;
import com.elexvx.silvae.filemanagement.infrastructure.BookBibliographyReader;
import com.elexvx.silvae.filemanagement.infrastructure.KnowledgeTextGateway;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class PublicBookMetadataTest {
    private final UUID id = UUID.randomUUID();
    private final DisplayCatalogService display = mock(DisplayCatalogService.class);
    private final BookMetadataRepository metadata = mock(BookMetadataRepository.class);
    private final BookRepository books = mock(BookRepository.class);
    private final KnowledgeTextGateway source = mock(KnowledgeTextGateway.class);
    private MockMvc mvc;

    @BeforeEach void setup() {
        var service = new PublicBookMetadataService(display, metadata, books, source);
        mvc = MockMvcBuilders.standaloneSetup(new PublicBookMetadataController(service))
                .setControllerAdvice(new ApiExceptionHandler()).build();
        when(display.findPublic(id)).thenReturn(new DisplayCatalogRepository.DisplayBook(id.toString(), "公开书", "作者", "简介",
                BookFormat.EPUB, "/api/v1/display-books/" + id + "/cover?v=4", true, 1));
        when(metadata.find(id)).thenReturn(Optional.of(new BookMetadataRepository.BookMetadata(id, "公开书", "副标题",
                List.of("作者"), List.of("译者"), "zh", "出版社", "2026-11", "123", "简介", "系列", BigDecimal.ONE,
                List.of("文学"), List.of("F"), "/secret/nas/cover.jpg", "/api/v1/books/" + id + "/cover",
                Map.of("description", "MANUAL", "publisher", "FILE", "title", "/secret/nas/book.epub", "path", "FILE"),
                true, "作者简介", "目录", List.of("文学研究"))));
    }

    @Test void anonymousProjectionIncludesBibliographyButNoStorageOrPersonalDataAndDoesNotParseFiles() throws Exception {
        String json = mvc.perform(get("/api/v1/display-books/{id}/metadata", id))
                .andExpect(status().isOk()).andExpect(jsonPath("$.publisher").value("出版社"))
                .andExpect(jsonPath("$.translators[0]").value("译者"))
                .andExpect(jsonPath("$.authorBiography").value("作者简介"))
                .andExpect(jsonPath("$.sources.description").value("MANUAL"))
                .andExpect(jsonPath("$.sources.title").doesNotExist())
                .andExpect(jsonPath("$.sources.path").doesNotExist())
                .andExpect(jsonPath("$.coverCacheKey").doesNotExist())
                .andExpect(jsonPath("$.readingPosition").doesNotExist())
                .andExpect(jsonPath("$.annotations").doesNotExist())
                .andExpect(jsonPath("$.notes").doesNotExist())
                .andExpect(jsonPath("$.reviews").doesNotExist())
                .andExpect(jsonPath("$.coverUrl").value("/api/v1/display-books/" + id + "/cover?v=4"))
                .andReturn().getResponse().getContentAsString();
        assertThat(json).doesNotContain("/secret/", "/api/v1/books/");
        verifyNoInteractions(books, source);
    }

    @Test void unpublishedMetadataNeverReachesThePrivateRepositories() throws Exception {
        when(display.findPublic(id)).thenThrow(ApiException.notFound("DISPLAY_BOOK_NOT_FOUND", "未公开"));
        mvc.perform(get("/api/v1/display-books/{id}/metadata", id)).andExpect(status().isNotFound());
        verifyNoInteractions(metadata, books, source);
    }

    @Test void unpublishingTakesEffectOnTheNextRequest() throws Exception {
        mvc.perform(get("/api/v1/display-books/{id}/metadata", id)).andExpect(status().isOk());
        when(display.findPublic(id)).thenThrow(ApiException.notFound("DISPLAY_BOOK_NOT_FOUND", "未公开"));
        mvc.perform(get("/api/v1/display-books/{id}/metadata", id)).andExpect(status().isNotFound());
        verify(metadata, times(1)).find(id);
    }

    @Test void sourceUsesTheControlledFileGateway() throws Exception {
        var file = file();
        when(books.findPreferredFile(id)).thenReturn(Optional.of(file));
        when(source.bibliography(file)).thenReturn(new BookBibliographyReader.Source("原书简介", "原书作者简介", "原书目录", List.of("F")));
        mvc.perform(get("/api/v1/display-books/{id}/bibliography-source", id))
                .andExpect(status().isOk()).andExpect(jsonPath("$.authorBiography").value("原书作者简介"))
                .andExpect(jsonPath("$.tableOfContents").value("原书目录"))
                .andExpect(jsonPath("$.relativePath").doesNotExist());
        var order = inOrder(display, books, source);
        order.verify(display).findPublic(id);
        order.verify(books).findPreferredFile(id);
        order.verify(source).bibliography(file);
        verifyNoInteractions(metadata);
    }

    @Test void unpublishedSourceCannotOpenAnyManagedFile() throws Exception {
        when(display.findPublic(id)).thenThrow(ApiException.notFound("DISPLAY_BOOK_NOT_FOUND", "未公开"));
        mvc.perform(get("/api/v1/display-books/{id}/bibliography-source", id)).andExpect(status().isNotFound());
        verifyNoInteractions(metadata, books, source);
    }

    @Test void sourceFingerprintConflictsArePreserved() throws Exception {
        var file = file();
        when(books.findPreferredFile(id)).thenReturn(Optional.of(file));
        when(source.bibliography(file)).thenThrow(ApiException.conflict("KNOWLEDGE_SOURCE_CHANGED", "源文件已变化"));
        mvc.perform(get("/api/v1/display-books/{id}/bibliography-source", id)).andExpect(status().isConflict());
    }

    @Test void loggedInReadPermissionsRemainDetailsScoped() {
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/display-books/" + id + "/metadata"))
                .isEqualTo(Set.of("library.details.view"));
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/display-books/" + id + "/bibliography-source"))
                .isEqualTo(Set.of("library.details.view"));
    }

    private BookFile file() {
        return new BookFile(UUID.randomUUID(), id, UUID.randomUUID(), "private/book.epub", BookFormat.EPUB,
                BookFileStatus.AVAILABLE, 1, OffsetDateTime.now(), "fingerprint", false, false, false);
    }
}
