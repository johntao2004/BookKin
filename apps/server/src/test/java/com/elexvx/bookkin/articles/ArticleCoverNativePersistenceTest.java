package com.elexvx.bookkin.articles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.filemanagement.infrastructure.PrivateContentStore;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.security.Principal;
import java.sql.DriverManager;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.flywaydb.core.Flyway;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.core.io.ByteArrayResource;

/** Opt-in native PostgreSQL verification; all fixtures live in an isolated, disposable schema. */
@EnabledIfEnvironmentVariable(named="BOOKKIN_NATIVE_TEST_URL",matches=".+")
class ArticleCoverNativePersistenceTest {
    @Test void persistsIndependentCoverReplacementAndRemoval() throws Exception {
        String url=System.getenv("BOOKKIN_NATIVE_TEST_URL");
        String user=System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_USER",System.getProperty("user.name"));
        String password=System.getenv().getOrDefault("BOOKKIN_NATIVE_TEST_PASSWORD","");
        String schema="bookkin_cover_"+UUID.randomUUID().toString().replace("-","");
        try(var admin=DriverManager.getConnection(url,user,password);var statement=admin.createStatement()) {
            statement.execute("create schema "+schema);
            try {
                Flyway.configure().dataSource(url,user,password).schemas(schema).defaultSchema(schema)
                        .locations("classpath:db/migration").load().migrate();
                UUID ownerId=UUID.randomUUID(),legacyId=UUID.randomUUID(),bodyAsset=UUID.randomUUID(),legacyCover=UUID.randomUUID();
                try(var connection=DriverManager.getConnection(url,user,password);var setup=connection.createStatement()) {
                    setup.execute("set search_path to "+schema+",public");
                    var db=DSL.using(connection,SQLDialect.POSTGRES);
                    db.execute("insert into app_users(id,username,display_name,password_hash,role) values (?,?,?,'test-only','OWNER')",ownerId,"cover-owner","封面测试");
                    for(var asset:new UUID[]{bodyAsset,legacyCover})db.execute("insert into article_assets values (?,?,'image/png')",asset,ownerId);
                    String legacyHtml="<p>旧正文</p><img src=\"/api/v1/articles/assets/"+legacyCover+"\">";
                    db.execute("insert into articles(id,owner_id,title,visibility,html) values (?,?,'旧文章','PRIVATE',?)",legacyId,ownerId,legacyHtml);
                    db.execute("insert into article_asset_links values (?,?)",legacyId,legacyCover);
                    db.execute("update articles set cover_asset_id=? where id=?",legacyCover,legacyId);

                    Flyway.configure().dataSource(url,user,password).schemas(schema).defaultSchema(schema)
                            .locations("classpath:db/migration").load().migrate();
                    connection.setAutoCommit(false);
                    assertThat(db.fetchValue("select cover_asset_id from articles where id=?",legacyId)).isEqualTo(legacyCover);
                    assertThat(db.fetchValue("select html from articles where id=?",legacyId)).isEqualTo(legacyHtml);

                    var owner=mock(BookKinUser.class);
                    when(owner.id()).thenReturn(ownerId);
                    when(owner.canManageFiles()).thenReturn(true);
                    var users=mock(UserRepository.class);
                    when(users.findByUsername("cover-owner")).thenReturn(Optional.of(owner));
                    var files=mock(PrivateContentStore.class);
                    when(files.resource(anyString(),any(UUID.class),any(UUID.class))).thenReturn(new ByteArrayResource(new byte[]{1}));
                    var service=new ArticleService(db,users,mock(PublicWebFetcher.class),files,null,null);
                    Principal principal=()->"cover-owner";
                    String body="<p>独立正文</p><img src='/api/v1/articles/assets/"+bodyAsset+"' alt='正文插图'>";
                    var png=new ByteArrayOutputStream();
                    ImageIO.write(new BufferedImage(12,8,BufferedImage.TYPE_INT_RGB),"png",png);
                    String upload="data:image/png;base64,"+Base64.getEncoder().encodeToString(png.toByteArray());
                    var created=service.save(null,new ArticleService.Draft("独立封面文章","作者","","","PRIVATE","",body,upload),principal);
                    UUID articleId=UUID.fromString(created.get("id").toString());
                    UUID coverId=(UUID)db.fetchValue("select cover_asset_id from articles where id=?",articleId);
                    String coverUrl="/api/v1/articles/assets/"+coverId;
                    assertThat(created).containsEntry("cover_url",coverUrl).doesNotContainKey("cover_asset_id");
                    assertThat(created.get("html").toString()).contains(bodyAsset.toString()).doesNotContain(coverId.toString());
                    assertThat(db.fetch("select asset_id from article_asset_links where article_id=?",articleId).getValues("asset_id",UUID.class)).containsExactlyInAnyOrder(bodyAsset,coverId);
                    assertThat(service.get(articleId,principal)).containsEntry("cover_url",coverUrl);
                    assertThat(service.list(principal).stream().filter(row->articleId.equals(row.get("id"))).findFirst().orElseThrow()).containsEntry("cover_url",coverUrl);

                    service.save(articleId,new ArticleService.Draft("独立封面文章","作者","","","PRIVATE","",body,""),principal);
                    assertThat(db.fetchValue("select cover_asset_id from articles where id=?",articleId)).isNull();
                    assertThat(db.fetch("select asset_id from article_asset_links where article_id=?",articleId).getValues("asset_id",UUID.class)).containsExactly(bodyAsset);
                    var noCover=service.get(articleId,principal);
                    assertThat(noCover.get("cover_url")).isNull();
                    assertThat(noCover.get("html").toString()).contains(bodyAsset.toString());
                    assertThat(service.list(principal).stream().filter(row->articleId.equals(row.get("id"))).findFirst().orElseThrow().get("cover_url")).isNull();
                }
            }finally {
                statement.execute("drop schema "+schema+" cascade");
            }
        }
    }
}
