package com.elexvx.bookkin.ingestion.upload;
import static org.junit.jupiter.api.Assertions.*;
import static com.elexvx.bookkin.ingestion.upload.BookUploadModels.*;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class BibliographyEnrichmentPreservationTest {
    @Test void enrichmentRetainsPrivateVisibilityDeepSubjectsNewDetailsAndExplicitManualBlanks() {
        var service=new MetadataEnrichmentService(null,null,null,null);
        var local=new MetadataDraft("本地书",null,List.of("作者"),List.of(),"zh",null,null,null,"",null,null,List.of(),null,null,
                Map.of("description",MetadataSource.MANUAL,"subjectCodes",MetadataSource.MANUAL),"book.epub",false,List.of("RNKH2"),"手工作者资料","手工目录");
        var candidate=new MetadataCandidate("candidate",MetadataSource.OPEN_LIBRARY,"候选书",null,List.of("候选作者"),"来源出版社",null,null,"不能覆盖手工清空的简介",List.of("生态"),null);
        var result=service.fillBlanks(local,List.of(candidate));
        assertEquals("",result.description());assertFalse(result.publiclyVisible());assertEquals(List.of("RNKH2"),result.subjectCodes());
        assertEquals("手工作者资料",result.authorBiography());assertEquals("手工目录",result.tableOfContents());
        assertEquals("来源出版社",result.publisher());
    }
}
