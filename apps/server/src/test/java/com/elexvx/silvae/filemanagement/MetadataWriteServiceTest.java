// 元数据写回会把原文件登记为可恢复版本，失败回滚仍保留该版本直到常规保留清理。
// Metadata writeback registers the original as a restorable version that remains through rollback and normal retention.
package com.elexvx.silvae.filemanagement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.elexvx.silvae.catalog.BookFile;
import com.elexvx.silvae.catalog.BookFileStatus;
import com.elexvx.silvae.catalog.BookFormat;
import com.elexvx.silvae.catalog.BookMetadataRepository;
import com.elexvx.silvae.catalog.BookMetadataRepository.BookMetadata;
import com.elexvx.silvae.config.SilvaeProperties;
import com.elexvx.silvae.ingestion.LibraryRoot;
import com.elexvx.silvae.ingestion.LibraryRoot.RootStatus;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class MetadataWriteServiceTest {
    @TempDir
    Path libraryRoot;

    @Test
    void replacesCurrentFileAndRetainsRegisteredVersionAfterCommit() throws Exception {
        Fixture fixture = fixture();

        var result = fixture.service().write(fixture.operationId(), fixture.file(), fixture.root(), fixture.source(), fixture.actorId());

        assertThat(Files.readString(fixture.source())).isEqualTo("updated");
        assertThat(result.versionPath()).exists();
        assertThat(result.versionPath().startsWith(libraryRoot.toRealPath().resolve(".silvae-versions"))).isTrue();
        assertThat(Files.readString(result.versionPath())).isEqualTo("original");
        verify(fixture.versions()).create(eq(fixture.file().id()), eq(fixture.root().id()),
                eq(".silvae-versions/" + fixture.file().id() + "/metadata-" + fixture.operationId() + ".version"),
                eq(fixture.file().relativePath()), eq(fixture.file().fingerprint()), eq(Files.size(result.versionPath())),
                eq("METADATA_WRITE"), eq(fixture.actorId()), any(OffsetDateTime.class));
        assertThat(result.versionPath()).exists();
        assertThat(Files.readString(result.versionPath())).isEqualTo("original");
        assertThat(Files.readString(fixture.source())).isEqualTo("updated");
    }

    @Test
    void restoresOriginalFromPersistentVersionWhenDatabaseCommitFails() throws Exception {
        Fixture fixture = fixture();

        var result = fixture.service().write(fixture.operationId(), fixture.file(), fixture.root(), fixture.source(), fixture.actorId());
        fixture.service().restoreOriginal(fixture.operationId(), fixture.file(), fixture.root(), fixture.source(), result);

        assertThat(Files.readString(fixture.source())).isEqualTo("original");
        assertThat(result.versionPath()).exists();
        assertThat(Files.readString(result.versionPath())).isEqualTo("original");
    }

    @Test
    void duplicateOperationIdCannotOverwriteAnExistingVersionOrCurrentFile() throws Exception {
        Fixture fixture = fixture();
        var first = fixture.service().write(fixture.operationId(), fixture.file(), fixture.root(), fixture.source(), fixture.actorId());
        String archived = Files.readString(first.versionPath());
        String current = Files.readString(fixture.source());

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> fixture.service().write(fixture.operationId(), fixture.file(),
                fixture.root(), fixture.source(), fixture.actorId())).isInstanceOf(java.io.IOException.class);

        assertThat(Files.readString(first.versionPath())).isEqualTo(archived);
        assertThat(Files.readString(fixture.source())).isEqualTo(current);
    }

    private Fixture fixture() throws Exception {
        UUID operationId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID bookId = UUID.randomUUID();
        UUID fileId = UUID.randomUUID();
        UUID rootId = UUID.randomUUID();
        Path source = libraryRoot.resolve("book.pdf");
        Files.writeString(source, "original");

        var fingerprints = new FileFingerprints();
        var file = new BookFile(fileId, bookId, rootId, "book.pdf", BookFormat.PDF, BookFileStatus.AVAILABLE,
                Files.size(source), OffsetDateTime.now(), fingerprints.sha256(source), false, false, false);
        var root = new LibraryRoot(rootId, "测试书库", libraryRoot.toString(), libraryRoot.toRealPath().toString(),
                RootStatus.ONLINE, true, true, true, true, null, OffsetDateTime.now(), null);

        var metadataRepository = mock(BookMetadataRepository.class);
        when(metadataRepository.find(bookId)).thenReturn(java.util.Optional.of(new BookMetadata(bookId, "新标题", null,
                List.of("作者"), List.of(), "zh-CN", null, null, null, null, null, BigDecimal.ONE,
                List.of(), null, null, Map.of())));
        var inspector = mock(FileInspector.class);
        when(inspector.inspect(source, BookFormat.PDF)).thenReturn(new FileInspector.Inspection(true, false, false, false));
        doNothing().when(inspector).assertReadable(any(Path.class), any(BookFormat.class));
        var pdfWriter = mock(PdfMetadataWriter.class);
        doAnswer(invocation -> {
            Files.writeString(invocation.getArgument(1, Path.class), "updated");
            return null;
        }).when(pdfWriter).write(any(Path.class), any(Path.class), any(BookMetadata.class));

        var versions = mock(FileVersionRepository.class);
        var service = new MetadataWriteService(metadataRepository, fingerprints, inspector,
                mock(EpubMetadataWriter.class), pdfWriter, versions,
                new SilvaeProperties(null, null, null, null, null, null, null, null, null, null, null));
        return new Fixture(operationId, actorId, file, root, source, service, versions);
    }

    private record Fixture(UUID operationId, UUID actorId, BookFile file, LibraryRoot root, Path source,
                           MetadataWriteService service, FileVersionRepository versions) {}
}
