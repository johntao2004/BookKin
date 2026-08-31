package io.github.johntao2004.bookkin.filemanagement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.johntao2004.bookkin.catalog.BookFile;
import io.github.johntao2004.bookkin.catalog.BookFileStatus;
import io.github.johntao2004.bookkin.catalog.BookFormat;
import io.github.johntao2004.bookkin.catalog.BookMetadataRepository;
import io.github.johntao2004.bookkin.catalog.BookMetadataRepository.BookMetadata;
import io.github.johntao2004.bookkin.ingestion.LibraryRoot;
import io.github.johntao2004.bookkin.ingestion.LibraryRoot.RootStatus;
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
    void replacesCurrentFileAndRemovesTransientRollbackAfterCommit() throws Exception {
        Fixture fixture = fixture();

        var result = fixture.service().write(fixture.operationId(), fixture.file(), fixture.root(), fixture.source());

        assertThat(Files.readString(fixture.source())).isEqualTo("updated");
        assertThat(result.rollbackPath()).exists();
        assertThat(libraryRoot.resolve(".bookkin-versions")).doesNotExist();

        fixture.service().complete(result);

        assertThat(result.rollbackPath()).doesNotExist();
        assertThat(Files.readString(fixture.source())).isEqualTo("updated");
    }

    @Test
    void restoresOriginalFromTransientRollbackWhenDatabaseCommitFails() throws Exception {
        Fixture fixture = fixture();

        var result = fixture.service().write(fixture.operationId(), fixture.file(), fixture.root(), fixture.source());
        fixture.service().restoreOriginal(fixture.operationId(), fixture.file(), fixture.root(), fixture.source(), result);

        assertThat(Files.readString(fixture.source())).isEqualTo("original");
        assertThat(result.rollbackPath()).doesNotExist();
        assertThat(libraryRoot.resolve(".bookkin-versions")).doesNotExist();
    }

    private Fixture fixture() throws Exception {
        UUID operationId = UUID.randomUUID();
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

        var service = new MetadataWriteService(metadataRepository, fingerprints, inspector,
                mock(EpubMetadataWriter.class), pdfWriter);
        return new Fixture(operationId, file, root, source, service);
    }

    private record Fixture(UUID operationId, BookFile file, LibraryRoot root, Path source,
                           MetadataWriteService service) {}
}
