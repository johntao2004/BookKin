package com.elexvx.bookkin.annotations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;
import com.elexvx.bookkin.articles.ArticleService;
import com.elexvx.bookkin.catalog.*;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.UserRepository;
import java.sql.DriverManager;
import java.util.HashSet;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import tools.jackson.databind.ObjectMapper;

@EnabledIfEnvironmentVariable(named="BOOKKIN_NATIVE_TEST_URL",matches=".+")
class ReadingPostsNativePersistenceTest {
    @Test
    void keepsSourcesAndAuthorsIsolatedAndPaginatesTheUnifiedCollection() throws Exception {
        String url=System.getenv("BOOKKIN_NATIVE_TEST_URL");
        String user=System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER",System.getProperty("user.name"));
        String password=System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD","");
        String schema="bookkin_posts_"+UUID.randomUUID().toString().replace("-","");
        try(var admin=DriverManager.getConnection(url,user,password);var setup=admin.createStatement()) {
            setup.execute("create schema "+schema);
            try {
                Flyway.configure().dataSource(url,user,password).schemas(schema).defaultSchema(schema)
                        .locations("classpath:db/migration").load().migrate();
                try(var connection=DriverManager.getConnection(url,user,password);var command=connection.createStatement()) {
                    command.execute("set search_path to "+schema+",public");
                    var db=DSL.using(connection,SQLDialect.POSTGRES);
                    UUID alice=UUID.randomUUID(),bob=UUID.randomUUID(),owner=UUID.randomUUID(),book=UUID.randomUUID(),article=UUID.randomUUID(),privateArticle=UUID.randomUUID();
                    for(var name:java.util.List.of("alice","bob","owner")) {
                        UUID id=name.equals("alice")?alice:name.equals("bob")?bob:owner;
                        db.execute("insert into app_users(id,username,display_name,password_hash,role) values (?,?,?,'test',?)",id,name,name,name.equals("owner")?"OWNER":"MEMBER");
                    }
                    db.execute("insert into books(id,title,sort_title,primary_author) values (?,'书籍来源','书籍来源','作者')",book);
                    db.execute("insert into articles(id,owner_id,title,author,visibility,html) values (?,?,'文章来源','作者','PUBLIC','<p>source</p>')",article,alice);
                    db.execute("insert into articles(id,owner_id,title,author,visibility,html) values (?,?,'私有文章','作者','PRIVATE','<p>private</p>')",privateArticle,alice);
                    var users=new UserRepository(db);
                    var catalog=new BookRepository(db);
                    var bookService=new BookReviewService(new BookReviewRepository(db),catalog,users);
                    var articleService=new ArticleService(db,users,null,null,null,new ObjectMapper());
                    var service=new ReadingPostsService(new ArticlePostRepository(db),bookService,catalog,articleService,users);
                    var old=bookService.create(book,"已有读后长文","# 旧内容",null,()->"alice");
                    var post=service.create(ReadingPostsService.Kind.ARTICLE,article,"文章随笔","# 标题\n\n"+"正文".repeat(1000),null,()->"alice");
                    assertEquals(ReviewVisibility.PRIVATE,post.visibility());
                    assertEquals(ReadingPostsService.Kind.ARTICLE,post.kind());
                    assertTrue(service.get(post.kind(),post.id(),()->"alice").markdown().length()>1000);
                    assertThat(service.mine(ReadingPostsService.Kind.BOOK,null,()->"alice").items()).extracting(ReadingPostsService.Post::id).containsExactly(old.id());
                    var articles=service.mine(ReadingPostsService.Kind.ARTICLE,null,()->"alice").items();
                    assertThat(articles).extracting(ReadingPostsService.Post::id).containsExactly(post.id());
                    assertNull(articles.getFirst().markdown());
                    assertEquals(240,articles.getFirst().excerpt().length());
                    assertTrue(service.mine(ReadingPostsService.Kind.ALL,null,()->"bob").items().isEmpty());
                    assertTrue(service.mine(ReadingPostsService.Kind.ALL,null,()->"owner").items().isEmpty());
                    assertEquals(404,assertThrows(ApiException.class,()->service.get(post.kind(),post.id(),()->"owner")).status().value());
                    assertEquals(404,assertThrows(ApiException.class,()->service.update(post.kind(),post.id(),"篡改","恶意",null,1,()->"bob")).status().value());
                    var changed=service.update(post.kind(),post.id(),"修订","## 新内容",ReviewVisibility.LIBRARY,1,()->"alice");
                    assertEquals(2,changed.revision());
                    assertEquals("## 新内容",service.get(post.kind(),post.id(),()->"bob").markdown());
                    assertEquals(409,assertThrows(ApiException.class,()->service.update(post.kind(),post.id(),"过期","旧稿",null,1,()->"alice")).status().value());
                    var hidden=service.create(ReadingPostsService.Kind.ARTICLE,privateArticle,"显式共享的随笔","私有来源",ReviewVisibility.LIBRARY,()->"alice");
                    assertEquals(404,assertThrows(ApiException.class,()->service.get(hidden.kind(),hidden.id(),()->"bob")).status().value());
                    assertEquals(404,assertThrows(ApiException.class,()->service.create(ReadingPostsService.Kind.ARTICLE,privateArticle,"越权来源","正文",null,()->"bob")).status().value());
                    assertEquals(400,assertThrows(ApiException.class,()->service.create(ReadingPostsService.Kind.ALL,article,"无效类型","正文",null,()->"alice")).status().value());
                    assertEquals(400,assertThrows(ApiException.class,()->service.mine(ReadingPostsService.Kind.ALL,"invalid cursor",()->"alice")).status().value());
                    assertEquals(400,assertThrows(ApiException.class,()->service.create(ReadingPostsService.Kind.ARTICLE,article,"标题","x".repeat(500001),null,()->"alice")).status().value());
                    for(int i=0;i<32;i++) service.create(i%2==0?ReadingPostsService.Kind.BOOK:ReadingPostsService.Kind.ARTICLE,i%2==0?book:article,"分页 "+i,"# 正文",null,()->"alice");
                    var first=service.mine(ReadingPostsService.Kind.ALL,null,()->"alice");
                    assertEquals(30,first.items().size());
                    assertNotNull(first.nextCursor());
                    var second=service.mine(ReadingPostsService.Kind.ALL,first.nextCursor(),()->"alice");
                    var ids=new HashSet<UUID>();
                    first.items().forEach(item->assertTrue(ids.add(item.id())));
                    second.items().forEach(item->assertTrue(ids.add(item.id())));
                    assertEquals(35,ids.size());
                    assertNull(second.nextCursor());
                    var bobsPost=service.create(ReadingPostsService.Kind.ARTICLE,article,"已有公开来源的私人随笔","自己的既有思考",null,()->"bob");
                    db.execute("update articles set visibility='PRIVATE' where id=?",article);
                    assertEquals("原文不可用",service.get(bobsPost.kind(),bobsPost.id(),()->"bob").sourceTitle());
                    assertEquals("自己的既有思考",service.get(bobsPost.kind(),bobsPost.id(),()->"bob").markdown());
                    assertEquals(1,service.mine(ReadingPostsService.Kind.ALL,null,()->"bob").items().size());
                    assertEquals(404,assertThrows(ApiException.class,()->service.get(post.kind(),post.id(),()->"bob")).status().value());
                    assertEquals(0,db.fetchOne("select count(*) from annotations").get(0,Integer.class));
                    assertEquals(0,db.fetchOne("select count(*) from article_reading").get(0,Integer.class));
                }
            } finally { setup.execute("drop schema "+schema+" cascade"); }
        }
    }
}
