package com.elexvx.bookkin.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import com.elexvx.bookkin.ingestion.CatalogIngestionRepository;
import com.elexvx.bookkin.ingestion.ExtractedBook;
import com.elexvx.bookkin.filemanagement.FileInspector;
import java.sql.DriverManager;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import tools.jackson.databind.ObjectMapper;

@EnabledIfEnvironmentVariable(named = "BOOKKIN_NATIVE_TEST_URL", matches = ".+")
class BibliographyThemaNativePersistenceTest {
    @TempDir Path temporary;
    @Test void uploadedDetailsPersistFiltersRespectPublicScopeAndScanningPreservesManualOverrides() throws Exception {
        var url=System.getenv("BOOKKIN_NATIVE_TEST_URL");
        var user=System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER", System.getProperty("user.name"));
        var password=System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD", "");
        var schema="bookkin_bibliography_"+UUID.randomUUID().toString().replace("-", "");
        try(var admin=DriverManager.getConnection(url,user,password); var statement=admin.createStatement()) {
            statement.execute("create schema "+schema);
            try {
                Flyway.configure().dataSource(url,user,password).schemas(schema).defaultSchema(schema).locations("classpath:db/migration").load().migrate();
                try(var connection=DriverManager.getConnection(url,user,password);var setup=connection.createStatement()) {
                    setup.execute("set search_path to "+schema+",public");
                    var db=DSL.using(connection,SQLDialect.POSTGRES);
                    var owner=UUID.randomUUID();var root=UUID.randomUUID();var book=UUID.randomUUID();var privateBook=UUID.randomUUID();var unknown=UUID.randomUUID();
                    db.execute("insert into app_users(id,username,display_name,password_hash,role) values (?,'fixture-owner','test','test','OWNER')",owner);
                    db.execute("insert into library_roots(id,name,configured_path) values (?,'test',?)",root,temporary.toString());
                    var file=temporary.resolve("fixture.epub");Files.writeString(file,"test-only file attributes");
                    var attributes=Files.readAttributes(file,BasicFileAttributes.class);
                    var ingestion=new CatalogIngestionRepository(db);
                    var metadata=new ExtractedBook("森林资料",null,List.of("作者"),List.of(),"完整简介","zh",null,null,null,null,null,List.of("生态"),null,null,100L,List.of("RNKH2"),"作者介绍","第一章\n第二章");
                    ingestion.createUploaded(book,owner,root,"fixture.epub","fixture.epub",BookFormat.EPUB,attributes,"sha256:fixture",new FileInspector.Inspection(true,false,false,false),metadata,"{}",new String[0],null);
                    var repository=new BookMetadataRepository(db,new ObjectMapper());
                    assertThat(repository.find(book).orElseThrow().subjectCodes()).containsExactly("RNKH2");
                    assertThat(repository.find(book).orElseThrow().language()).isEqualTo("zh");
                    assertThat(repository.find(book).orElseThrow().authorBiography()).isEqualTo("作者介绍");
                    assertThat(repository.find(book).orElseThrow().tableOfContents()).isEqualTo("第一章\n第二章");
                    String languages=String.join(",",java.util.Collections.nCopies(340,"en"))+",abcd";
                    assertThat(languages).hasSize(1024);
                    repository.update(book,new BookMetadataRepository.MetadataPatch(null,null,null,null,languages,null,null,null,null,null,null,null,List.of(),new String[]{"language"},null,null));
                    assertThat(repository.find(book).orElseThrow().language()).isEqualTo(languages);
                    // Second and unclassified books use the same normal persistence gateway.
                    ingestion.createUploaded(privateBook,owner,root,"private.epub","private.epub",BookFormat.EPUB,attributes,"sha256:private",new FileInspector.Inspection(true,false,false,false),metadata,"{}",new String[0],null);
                    var empty=new ExtractedBook("未分类书",null,List.of("作者"),List.of(),null,"zh",null,null,null,null,null,List.of(),null,null,null);
                    ingestion.createUploaded(unknown,owner,root,"unknown.epub","unknown.epub",BookFormat.EPUB,attributes,"sha256:unknown",new FileInspector.Inspection(true,false,false,false),empty,"{}",new String[0],null);
                    var publicCatalog=new DisplayCatalogRepository(db);publicCatalog.add(book,owner,0);
                    var books=new BookRepository(db);
                    assertThat(books.list(owner,null,null,null,BookSort.TITLE,null,10,"R").items()).hasSize(2);
                    assertThat(books.list(owner,null,null,null,BookSort.TITLE,null,1,"RNK").nextCursor()).isNotNull();
                    assertThat(books.list(owner,null,null,null,BookSort.TITLE,null,10,"UNCLASSIFIED").items()).extracting(BookRepository.BookSummary::id).containsExactly(unknown.toString());
                    assertThat(publicCatalog.list(null,null,null,BookSort.TITLE,null,10,"R").items()).extracting(DisplayCatalogRepository.DisplayBook::id).containsExactly(book.toString());
                    assertThat(publicCatalog.list(null,null,null,BookSort.TITLE,null,10,"UNCLASSIFIED").items()).isEmpty();
                    repository.update(book,new BookMetadataRepository.MetadataPatch(null,null,null,null,null,null,null,null,null,null,null,null,List.of("AKH"),new String[]{"subjectCodes","authorBiography","tableOfContents"},"手工作者介绍","手工目录"));
                    ingestion.upsert(root,"fixture.epub","fixture.epub",BookFormat.EPUB,attributes,"quick","sha256:fixture",new FileInspector.Inspection(true,false,false,false),metadata,null);
                    var saved=repository.find(book).orElseThrow();
                    assertThat(saved.subjectCodes()).containsExactly("AKH");assertThat(saved.authorBiography()).isEqualTo("手工作者介绍");assertThat(saved.tableOfContents()).isEqualTo("手工目录");
                    assertThat(saved.language()).isEqualTo(languages);
                    assertThat(saved.sources()).containsEntry("subjectCodes","MANUAL");
                    assertThat(saved.sources()).containsEntry("language","MANUAL");
                    assertThrows(com.elexvx.bookkin.common.ApiException.class,()->repository.update(book,new BookMetadataRepository.MetadataPatch(null,null,null,null,null,null,null,null,null,null,null,null,List.of("1FPC"),new String[]{"subjectCodes"})));
                    assertThat(repository.find(book).orElseThrow().subjectCodes()).containsExactly("AKH");
                }
            } finally { statement.execute("drop schema "+schema+" cascade"); }
        }
    }
}
