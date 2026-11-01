package com.elexvx.bookkin.filemanagement;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.auth.RolePermissionService;
import com.elexvx.bookkin.catalog.*;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.config.BookKinProperties;
import com.elexvx.bookkin.ingestion.LibraryRootRepository;
import com.elexvx.bookkin.users.*;
import java.nio.file.*;
import java.sql.DriverManager;
import java.time.OffsetDateTime;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named = "BOOKKIN_NATIVE_TEST_URL", matches = ".+")
class BookTitleSynchronizationNativeTest {
    @Test void synchronizesAndRestoresFilesWithTheDatabase(@TempDir Path root) throws Exception {
        String url = System.getenv("BOOKKIN_NATIVE_TEST_URL");
        String user = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER", System.getProperty("user.name"));
        String password = System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD", "");
        String schema = "bookkin_title_sync_" + UUID.randomUUID().toString().replace("-", "");
        try (var admin = DriverManager.getConnection(url, user, password); var sql = admin.createStatement()) {
            sql.execute("create schema " + schema);
            try {
                Flyway.configure().dataSource(url,user,password).schemas(schema).defaultSchema(schema).locations("classpath:db/migration").load().migrate();
                var ds = new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema + ",public",user,password);
                var db = DSL.using(new TransactionAwareDataSourceProxy(ds),SQLDialect.POSTGRES);
                var tx = new TransactionTemplate(new DataSourceTransactionManager(ds));
                UUID actor=UUID.randomUUID(), rootId=UUID.randomUUID(), book=UUID.randomUUID();
                db.execute("insert into app_users(id,username,display_name,password_hash,role,status) values (?,'owner','主人','test','OWNER','ACTIVE')",actor);
                db.execute("insert into library_roots(id,name,configured_path,canonical_path,status,can_read,can_write,can_atomic_move,can_stage) values (?,'同步书库',?,?,'ONLINE',true,true,true,true)",rootId,root.toString(),root.toString());
                db.execute("insert into books(id,title,sort_title,primary_author) values (?,'旧书名','旧书名','作者')",book);
                Files.createDirectories(root.resolve("作者"));
                var fingerprints = new FileFingerprints();
                for (String format : List.of("EPUB","PDF")) {
                    Path path=root.resolve("作者/原文件."+format.toLowerCase(Locale.ROOT)); Files.writeString(path,"unchanged "+format);
                    db.execute("insert into book_files(id,book_id,library_root_id,relative_path,normalized_path,format,status,size_bytes,modified_at,fingerprint,quick_fingerprint) values (?,?,?,?,?,?,'AVAILABLE',?,now(),?,'test')",UUID.randomUUID(),book,rootId,"作者/"+path.getFileName(),"作者/"+path.getFileName(),format,Files.size(path),fingerprints.sha256(path));
                }
                var books=new BookRepository(db); var roots=new LibraryRootRepository(db);
                var properties=new BookKinProperties(null,null,null,null,null,null,null,null,null,null,null);
                var operations=new FileOperationRepository(db,properties); var leases=new FileLeaseRepository(db); var paths=new PathPolicy();
                var users=mock(UserRepository.class);
                when(users.findByUsername("owner")).thenReturn(Optional.of(new BookKinUser(actor,"owner","主人","hash",UserRole.OWNER,UserStatus.ACTIVE,false,OffsetDateTime.now(),null)));
                var permissions=mock(RolePermissionService.class); var audit=mock(AuditService.class); var recycle=mock(RecycleBinRepository.class);
                var executor=new FileTransactionExecutor(operations,books,roots,recycle,mock(FileVersionRepository.class),leases,fingerprints,mock(FileInspector.class),mock(MetadataWriteService.class),audit,properties,paths);
                var files=new FileOperationService(books,roots,users,operations,paths,fingerprints,leases,recycle,permissions);
                var sync=new BookTitleFileService(books,files,operations,executor,paths);
                var metadata=new BookMetadataRepository(db,new ObjectMapper());
                var editing=new MetadataEditingService(metadata,mock(DisplayCatalogService.class),sync);
                java.util.function.Consumer<String> save=title -> tx.executeWithoutResult(status -> editing.update(book,patch(title),null,() -> "owner"));
                save.accept("新书名");
                assertThat(metadata.find(book).orElseThrow().title()).isEqualTo("新书名");
                assertThat(books.findActiveFiles(book)).extracting(BookFile::relativePath).containsExactlyInAnyOrder("作者/新书名.epub","作者/新书名.pdf");
                assertThat(Files.readString(root.resolve("作者/新书名.epub"))).isEqualTo("unchanged EPUB");
                save.accept("新书名"); assertThat(operations.count()).isEqualTo(2);
                assertThatThrownBy(() -> tx.executeWithoutResult(status -> { editing.update(book,patch("回滚书名"),null,() -> "owner"); throw new IllegalStateException("late DB failure"); })).isInstanceOf(IllegalStateException.class);
                assertThat(metadata.find(book).orElseThrow().title()).isEqualTo("新书名");
                assertThat(Files.exists(root.resolve("作者/新书名.epub"))).isTrue(); assertThat(Files.exists(root.resolve("作者/新书名.pdf"))).isTrue();
                assertThat(Files.exists(root.resolve("作者/回滚书名.epub"))).isFalse(); assertThat(operations.count()).isEqualTo(2);
                verify(audit,times(2)).recordIndependent(eq(actor),eq("TITLE_SYNC_ROLLBACK"),anyString(),anyString(),anyString(),anyString(),anyString(),anyString(),eq("ROLLED_BACK"),anyString());
                var first=books.findActiveFiles(book).getFirst();
                String secondExtension=first.format()==BookFormat.EPUB ? "pdf":"epub";
                Path occupied=root.resolve("作者/占用书名."+secondExtension); Files.writeString(occupied,"do not overwrite");
                assertThatThrownBy(() -> save.accept("占用书名")).isInstanceOfSatisfying(ApiException.class,e -> assertThat(e.code()).isEqualTo("TARGET_EXISTS"));
                assertThat(metadata.find(book).orElseThrow().title()).isEqualTo("新书名"); assertThat(Files.readString(occupied)).isEqualTo("do not overwrite");
                assertThat(books.findActiveFiles(book)).allSatisfy(f -> assertThat(Files.isRegularFile(root.resolve(f.relativePath()))).isTrue());
                Path changed=root.resolve(first.relativePath()); String original=Files.readString(changed); Files.writeString(changed,"external edit");
                assertThatThrownBy(() -> save.accept("指纹书名")).isInstanceOfSatisfying(ApiException.class,e -> assertThat(e.code()).isEqualTo("SOURCE_CHANGED"));
                assertThat(metadata.find(book).orElseThrow().title()).isEqualTo("新书名"); Files.writeString(changed,original);
                Path actual=root.resolve("真实文件"); Files.move(changed,actual); Files.createSymbolicLink(changed,actual);
                assertThatThrownBy(() -> save.accept("链接书名")).isInstanceOfSatisfying(ApiException.class,e -> assertThat(e.code()).isEqualTo("UNSAFE_PATH"));
                assertThat(Files.isSymbolicLink(changed)).isTrue(); assertThat(Files.readString(actual)).isEqualTo(original);
                Files.delete(changed); Files.move(actual,changed);
                doThrow(ApiException.forbidden("PERMISSION_DENIED","无权限")).when(permissions).require(any(),eq("library.files"));
                assertThatThrownBy(() -> save.accept("越权书名")).isInstanceOf(ApiException.class);
                assertThat(metadata.find(book).orElseThrow().title()).isEqualTo("新书名"); assertThat(operations.count()).isEqualTo(2);
                reset(permissions);
                save.accept("MixedCase"); save.accept("mixedcase");
                try (var names = Files.list(root.resolve("作者"))) {
                    assertThat(names.map(p -> p.getFileName().toString()).toList()).contains("mixedcase.epub", "mixedcase.pdf").doesNotContain("MixedCase.epub", "MixedCase.pdf");
                }

            } finally { sql.execute("drop schema "+schema+" cascade"); }
        }
    }
    private BookMetadataRepository.MetadataPatch patch(String title) {
        return new BookMetadataRepository.MetadataPatch(title,null,null,null,null,null,null,null,null,null,null,null,null,new String[]{"title"},null,null);
    }
}
