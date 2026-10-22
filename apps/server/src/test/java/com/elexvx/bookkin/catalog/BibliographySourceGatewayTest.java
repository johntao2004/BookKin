package com.elexvx.bookkin.catalog;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.elexvx.bookkin.filemanagement.*;
import com.elexvx.bookkin.filemanagement.infrastructure.*;
import com.elexvx.bookkin.ingestion.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BibliographySourceGatewayTest {
    @TempDir Path rootPath;
    @Test void rejectsChangedSourcesAndReleasesLeaseEvenWhenExtractionCannotBegin() throws Exception {
        var filePath=rootPath.resolve("changed.epub");Files.writeString(filePath,"changed source");
        var rootId=UUID.randomUUID();var fileId=UUID.randomUUID();
        var file=new BookFile(fileId,UUID.randomUUID(),rootId,"changed.epub",BookFormat.EPUB,BookFileStatus.AVAILABLE,1,OffsetDateTime.now(),"sha256:old",false,false,false);
        var roots=mock(LibraryRootRepository.class);var leases=mock(FileLeaseRepository.class);var lease=new FileLeaseRepository.Lease(fileId,"test");
        when(roots.findById(rootId)).thenReturn(Optional.of(new LibraryRoot(rootId,"test",rootPath.toString(),rootPath.toRealPath().toString(),LibraryRoot.RootStatus.ONLINE,true,true,true,true,null,null,null)));
        when(leases.acquireRead(eq(fileId),anyString(),any())).thenReturn(lease);
        var gateway=new KnowledgeTextGateway(roots,leases,new PathPolicy(),new FileFingerprints(),mock(BookTextSampler.class));
        assertThrows(com.elexvx.bookkin.common.ApiException.class,()->gateway.bibliography(file));
        verify(leases).release(lease);
        assertEquals("changed source",Files.readString(filePath));
    }
}
