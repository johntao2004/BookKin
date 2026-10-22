package com.elexvx.bookkin.ingestion;

import com.elexvx.bookkin.auth.ApiPermissionPolicy;
import com.elexvx.bookkin.config.BookKinProperties;
import com.elexvx.bookkin.filemanagement.FileFingerprints;
import com.elexvx.bookkin.filemanagement.FileInspector;
import com.elexvx.bookkin.filemanagement.infrastructure.PrivateContentStore;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ContentStorageIsolationTest {
    @TempDir Path temporary;
    @Test void refusesLegacyOverlappingBookRootsWithoutScanningOrMarkingBooksMissing() throws Exception {
        Path base = temporary.toRealPath();
        var content = new PrivateContentStore(base.resolve("content").toString(), "", "");
        content.initialize();
        Path vault = base.resolve("content/vault");
        var root = new LibraryRoot(UUID.randomUUID(), "旧重叠书库", vault.toString(), vault.toString(), LibraryRoot.RootStatus.ONLINE, true, true, true, true, 100L, null, null);
        var roots = mock(LibraryRootRepository.class);
        when(roots.findAll()).thenReturn(List.of(root));
        var catalog = mock(CatalogIngestionRepository.class);
        var fingerprints = mock(FileFingerprints.class);
        var inspector = mock(FileInspector.class);
        var metadata = mock(BookMetadataExtractor.class);
        var properties = mock(BookKinProperties.class);
        var scanner = new LibraryScanCoordinator(roots, catalog, fingerprints, inspector, metadata, properties, content);
        assertThat(scanner.scanAll().failed()).isEqualTo(1);
        verifyNoInteractions(catalog, fingerprints, inspector, metadata);
        verify(roots, never()).recordScan(any());
        new LibraryRootCapabilityService(roots, properties, content).check(root);
        verify(roots).updateCapabilities(root.id(), null, LibraryRoot.RootStatus.OFFLINE, false, false, false, false, null);
        assertThat(Files.exists(vault.resolve(".bookkin-staging"))).isFalse();
    }
    @Test void storageLocationsRequireManagementPermissionRatherThanOrdinaryUploadPermission() {
        assertThat(ApiPermissionPolicy.required("GET", "/api/v1/library-roots/content-storage")).containsExactly("settings.roots.view");
    }
    @Test void startupRejectsOverlapBeforeCreatingContentDirectories() throws Exception {
        Path base = temporary.toRealPath();
        Path books = Files.createDirectory(base.resolve("books"));
        var content = new PrivateContentStore(base.resolve("content").toString(), books.resolve("articles").toString(), "");
        var roots = mock(LibraryRootRepository.class);
        var properties = mock(BookKinProperties.class);
        when(properties.storage()).thenReturn(new BookKinProperties.Storage(List.of(new BookKinProperties.ConfiguredRoot("书籍", books.toString()))));
        var initializer = new ContentStorageInitializer(content, roots, properties, mock(com.elexvx.bookkin.filemanagement.ContentStorageService.class));
        assertThatThrownBy(() -> initializer.run(null)).isInstanceOf(IllegalArgumentException.class);
        assertThat(Files.exists(books.resolve("articles"))).isFalse();
        assertThat(Files.exists(base.resolve("content"))).isFalse();
    }
}
