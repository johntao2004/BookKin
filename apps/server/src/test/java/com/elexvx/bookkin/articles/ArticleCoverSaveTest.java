package com.elexvx.bookkin.articles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.elexvx.bookkin.ai.AiMetadataService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.filemanagement.infrastructure.PrivateContentStore;
import com.elexvx.bookkin.users.BookKinUser;
import com.elexvx.bookkin.users.UserRepository;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.security.Principal;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.jooq.DSLContext;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.jooq.tools.jdbc.MockConnection;
import org.jooq.tools.jdbc.MockResult;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;

class ArticleCoverSaveTest {
    private static final UUID OWNER_ID = UUID.fromString("00000000-0000-4000-8000-000000000001");
    private static final UUID ARTICLE_ID = UUID.fromString("00000000-0000-4000-8000-000000000002");
    private static final UUID BODY_ASSET_ID = UUID.fromString("00000000-0000-4000-8000-000000000003");
    private static final UUID OLD_COVER_ID = UUID.fromString("00000000-0000-4000-8000-000000000004");
    private static final Principal OWNER = () -> "owner";

    @Test
    void savesUploadedCoverAsPngAndLinksItAlongsideBodyImages() throws Exception {
        var database = new ArticleDatabase(OWNER_ID, Set.of(BODY_ASSET_ID), List.of());
        var files = mock(PrivateContentStore.class);
        var storedFiles = new ArrayList<byte[]>();
        doAnswer(call -> {
            InputStream input = call.getArgument(3);
            storedFiles.add(input.readAllBytes());
            return null;
        }).when(files).create(eq("articles"), eq(OWNER_ID), any(UUID.class), any(InputStream.class), anyLong());
        when(files.resource(eq("articles"), eq(OWNER_ID), any(UUID.class)))
                .thenReturn(new ByteArrayResource(new byte[] {1}));
        var service = service(database.dsl, files);
        String coverData = dataUri("jpeg");
        var draft = draft("<p>正文</p><img src='/api/v1/articles/assets/" + BODY_ASSET_ID + "'>", coverData);

        var saved = service.save(null, draft, OWNER);

        UUID coverId = database.articleCoverWrites.getFirst();
        assertThat(coverId).isNotNull();
        assertThat(saved).containsEntry("cover_url", "/api/v1/articles/assets/" + coverId);
        assertThat(saved).doesNotContainKey("cover_asset_id");
        assertThat(storedFiles).hasSize(1);
        assertThat(storedFiles.getFirst()).startsWith(new byte[] {(byte) 0x89, 'P', 'N', 'G'});
        assertThat(database.assetLinks).containsExactlyInAnyOrder(BODY_ASSET_ID, coverId);
    }

    @Test
    void clearingCoverStoresNullAndKeepsOnlyBodyAssetLink() {
        var database = new ArticleDatabase(OWNER_ID, Set.of(BODY_ASSET_ID), Arrays.asList(OLD_COVER_ID, null));
        var files = mock(PrivateContentStore.class);
        var service = service(database.dsl, files);
        var draft = draft("<p>正文</p><img src='/api/v1/articles/assets/" + BODY_ASSET_ID + "'>", null);

        var saved = service.save(ARTICLE_ID, draft, OWNER);

        assertThat(database.articleCoverWrites).containsExactly((UUID) null);
        assertThat(database.assetLinks).containsExactly(BODY_ASSET_ID);
        assertThat(saved).containsEntry("cover_url", null);
        assertThat(saved).doesNotContainKey("cover_asset_id");
    }

    @Test
    void rejectsAnInternalCoverTheUserCannotReadBeforeSavingTheArticle() {
        var database = new ArticleDatabase(OWNER_ID, Set.of(), List.of());
        var service = service(database.dsl, mock(PrivateContentStore.class));

        assertThatThrownBy(() -> service.save(null,
                draft("<p>正文</p>", "/api/v1/articles/assets/" + OLD_COVER_ID), OWNER))
                .isInstanceOfSatisfying(ApiException.class,
                        failure -> assertThat(failure.code()).isEqualTo("ASSET_NOT_FOUND"));

        assertThat(database.articleCoverWrites).isEmpty();
    }

    private static ArticleService service(DSLContext database, PrivateContentStore files) {
        var owner = mock(BookKinUser.class);
        when(owner.id()).thenReturn(OWNER_ID);
        when(owner.canManageFiles()).thenReturn(true);
        var users = mock(UserRepository.class);
        when(users.findByUsername("owner")).thenReturn(Optional.of(owner));
        return new ArticleService(database, users, null, files, (AiMetadataService) null, null);
    }

    private static ArticleService.Draft draft(String html, String coverUrl) {
        return new ArticleService.Draft("文章", "作者", "https://example.test/article", "", "PUBLIC", "", html,
                coverUrl);
    }

    private static String dataUri(String format) throws Exception {
        var image = new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB);
        var output = new ByteArrayOutputStream();
        ImageIO.write(image, format, output);
        return "data:image/" + format + ";base64," + java.util.Base64.getEncoder().encodeToString(output.toByteArray());
    }

    private static final class ArticleDatabase {
        private final DSLContext dsl;
        private final List<UUID> articleCoverWrites = new ArrayList<>();
        private final List<UUID> assetLinks = new ArrayList<>();
        private final List<UUID> articleCovers;
        private final Set<UUID> readableAssets;
        private final UUID ownerId;
        private int articleReads;
        private UUID lastArticleCoverWrite;

        private ArticleDatabase(UUID ownerId, Set<UUID> readableAssets, List<UUID> articleCovers) {
            this.ownerId = ownerId;
            this.readableAssets = readableAssets;
            this.articleCovers = articleCovers;
            this.dsl = DSL.using(new MockConnection(this::execute), SQLDialect.POSTGRES);
        }

        private MockResult[] execute(org.jooq.tools.jdbc.MockExecuteContext context) throws SQLException {
            String sql = context.sql().toLowerCase(java.util.Locale.ROOT);
            var bindings = new ArrayList<>(Arrays.asList(context.bindings()));
            if (sql.startsWith("select id,source_url")) {
                var db = DSL.using(SQLDialect.POSTGRES);
                return new MockResult[]{new MockResult(0,db.newResult(DSL.field("id",UUID.class),DSL.field("source_url",String.class),DSL.field("html",String.class)))};
            }
            if (sql.startsWith("select exists")) {
                var db = DSL.using(SQLDialect.POSTGRES);
                var field = DSL.field("exists",Boolean.class);
                var result = db.newResult(field);
                var row = db.newRecord(field);
                row.set(field,false);
                result.add(row);
                return new MockResult[]{new MockResult(1,result)};
            }
            if (sql.startsWith("select owner_id from article_assets")) {
                UUID assetId = (UUID) bindings.getFirst();
                if (!readableAssets.contains(assetId)) return emptyAssetResult();
                return ownerResult(ownerId);
            }
            if (sql.startsWith("select * from articles")) {
                UUID cover = articleReads < articleCovers.size()
                        ? articleCovers.get(articleReads++)
                        : lastArticleCoverWrite;
                return articleResult((UUID) bindings.getFirst(), cover);
            }
            if (sql.startsWith("insert into articles")) {
                lastArticleCoverWrite = (UUID) bindings.get(9);
                articleCoverWrites.add(lastArticleCoverWrite);
            } else if (sql.startsWith("insert into article_asset_links")) {
                assetLinks.add((UUID) bindings.get(1));
            }
            return new MockResult[0];
        }

        private MockResult[] emptyAssetResult() {
            var database = DSL.using(SQLDialect.POSTGRES);
            var owner = DSL.field("owner_id", UUID.class);
            return new MockResult[] {new MockResult(0, database.newResult(owner))};
        }

        private MockResult[] ownerResult(UUID ownerId) {
            var database = DSL.using(SQLDialect.POSTGRES);
            var owner = DSL.field("owner_id", UUID.class);
            var result = database.newResult(owner);
            var row = database.newRecord(owner);
            row.set(owner, ownerId);
            result.add(row);
            return new MockResult[] {new MockResult(1, result)};
        }

        private MockResult[] articleResult(UUID articleId, UUID coverId) {
            var database = DSL.using(SQLDialect.POSTGRES);
            var id = DSL.field("id", UUID.class);
            var cover = DSL.field("cover_asset_id", UUID.class);
            var result = database.newResult(id, cover);
            var row = database.newRecord(id, cover);
            row.set(id, articleId);
            row.set(cover, coverId);
            result.add(row);
            return new MockResult[] {new MockResult(1, result)};
        }
    }
}
