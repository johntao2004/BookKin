package com.elexvx.bookkin.articles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import java.security.Principal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.flywaydb.core.Flyway;
import org.jooq.DSLContext;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/** Real transactions verify legacy data, updates and races without touching the user's collection. */
@EnabledIfEnvironmentVariable(named="BOOKKIN_NATIVE_TEST_URL",matches=".+")
class ArticleDuplicateNativePersistenceTest {
    private static final Principal OWNER=()->"duplicate-owner";

    @Test void rejectsDuplicatesAcrossLegacyCaptureManualImportUpdatesAndConcurrentRequests() throws Exception {
        String url=System.getenv("BOOKKIN_NATIVE_TEST_URL");
        String user=System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER",System.getProperty("user.name"));
        String password=System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD","");
        String schema="bookkin_duplicate_"+UUID.randomUUID().toString().replace("-","");
        try(var admin=DriverManager.getConnection(url,user,password);var statement=admin.createStatement()) {
            statement.execute("create schema "+schema);
            try {
                migrate(url,user,password,schema,null);
                try(var connection=connect(url,user,password,schema)) {
                    var db=DSL.using(connection,SQLDialect.POSTGRES);
                    UUID ownerId=UUID.randomUUID();
                    db.execute("insert into app_users(id,username,display_name,password_hash,role) values (?,'duplicate-owner','测试','test-only','OWNER')",ownerId);
                    UUID legacy=UUID.randomUUID();
                    db.execute("insert into articles(id,owner_id,title,source_url,visibility,html) values (?,?,'旧文章','https://example.com/legacy?utm_source=old','PRIVATE','<p>已有文章正文</p>')",legacy,ownerId);
                    db.execute("insert into articles(id,owner_id,title,visibility,html) values (?,?,'旧重复文章','PRIVATE','<p>已有文章正文</p>')",UUID.randomUUID(),ownerId);
                    connection.commit();
                    migrate(url,user,password,schema,null);
                    assertThat(db.fetchCount(DSL.table("articles"))).isEqualTo(2);
                    connection.commit();

                    var actor=mock(BookKinUser.class);
                    when(actor.id()).thenReturn(ownerId);
                    when(actor.canManageFiles()).thenReturn(true);
                    var users=mock(UserRepository.class);
                    when(users.findByUsername(OWNER.getName())).thenReturn(Optional.of(actor));
                    var web=mock(PublicWebFetcher.class);
                    var service=new ArticleService(db,users,web,null,null,null);
                    assertDuplicate(()->service.fetch("https://example.com/legacy#heading",OWNER));
                    verifyNoInteractions(web);
                    connection.rollback();
                    assertDuplicate(()->service.save(null,draft("不同标题","","<section><strong>已有文章正文</strong></section>"),OWNER));
                    connection.rollback();

                    var created=service.save(null,draft("同名文章","https://example.com/new?id=1","<p>新正文一</p>"),OWNER);
                    UUID id=(UUID)created.get("id");
                    assertThat(created).doesNotContainKeys("duplicate_source_key","duplicate_content_key");
                    connection.commit();
                    assertThat(db.fetchCount(DSL.table("articles"))).isEqualTo(3);
                    service.save(id,draft("编辑后的标题","https://example.com/new?id=1&utm_source=edit","<p>新正文一</p>"),OWNER);
                    connection.commit();
                    assertDuplicate(()->service.save(null,draft("不同标题","https://example.com/new?utm_medium=share&id=1#fragment","<p>完全不同正文</p>"),OWNER));
                    connection.rollback();
                    assertDuplicate(()->service.save(null,draft("不同标题","https://other.example/copy","<p><em>新正文一</em></p>"),OWNER));
                    connection.rollback();
                    assertDuplicate(()->service.save(id,draft("编辑冲突","https://example.com/legacy","<p>新正文一</p>"),OWNER));
                    connection.rollback();
                    assertThat(service.get(id,OWNER).get("title")).isEqualTo("编辑后的标题");
                    service.save(null,draft("同名文章","https://example.com/new?id=2","<p>新正文二</p>"),OWNER);
                    service.save(null,draft("空正文一","",""),OWNER);
                    service.save(null,draft("空正文二","","<p> </p>"),OWNER);
                    connection.commit();

                    CountDownLatch ready=new CountDownLatch(2);
                    try(var executor=Executors.newFixedThreadPool(2)) {
                        java.util.concurrent.Callable<Boolean> save=()->{
                            try(var concurrent=connect(url,user,password,schema)) {
                                var concurrentDb=DSL.using(concurrent,SQLDialect.POSTGRES);
                                var concurrentService=new ArticleService(concurrentDb,users,web,null,null,null) {
                                    @Override public String clean(String html,String base,Principal principal) {
                                        String clean=super.clean(html,base,principal);
                                        ready.countDown();
                                        try { if(!ready.await(10,TimeUnit.SECONDS))throw new IllegalStateException("Race did not start"); }
                                        catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new IllegalStateException(interrupted);}
                                        return clean;
                                    }
                                };
                                try {
                                    concurrentService.save(null,draft("并发文章","","<p>并发重复正文</p>"),OWNER);
                                    concurrent.commit();
                                    return true;
                                } catch(ApiException duplicate) {
                                    concurrent.rollback();
                                    assertThat(duplicate.code()).isEqualTo("ARTICLE_DUPLICATE");
                                    return false;
                                }
                            }
                        };
                        var first=executor.submit(save);
                        var second=executor.submit(save);
                        assertThat(java.util.List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS)))
                                .containsExactlyInAnyOrder(true,false);
                    }
                    assertThat(db.fetchOne("select count(*) from articles where title='并发文章'").get(0,Integer.class)).isEqualTo(1);
                    connection.commit();
                }
            } finally { statement.execute("drop schema "+schema+" cascade"); }
        }
    }

    private static void assertDuplicate(org.assertj.core.api.ThrowableAssert.ThrowingCallable action) {
        assertThatThrownBy(action).isInstanceOfSatisfying(ApiException.class,error->{
            assertThat(error.code()).isEqualTo("ARTICLE_DUPLICATE");
            assertThat(error.status().value()).isEqualTo(409);
        });
    }

    private static ArticleService.Draft draft(String title,String source,String html) {
        return new ArticleService.Draft(title,"",source,"","PUBLIC","",html,"");
    }

    private static Connection connect(String url,String user,String password,String schema) throws Exception {
        var connection=DriverManager.getConnection(url,user,password);
        try(var statement=connection.createStatement()) { statement.execute("set search_path to "+schema+",public"); }
        connection.setAutoCommit(false);
        return connection;
    }

    private static void migrate(String url,String user,String password,String schema,String target) {
        var config=Flyway.configure().dataSource(url,user,password).schemas(schema).defaultSchema(schema).locations("classpath:db/migration");
        if(target!=null)config.target(target);
        config.load().migrate();
    }
}
