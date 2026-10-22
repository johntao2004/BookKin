package com.elexvx.bookkin.articles;

import com.elexvx.bookkin.users.BookKinUser;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

/** Persistence boundary for article collections; authorization decisions stay in the application service. */
@Repository
public class ArticleCollectionRepository {
    private final DSLContext db;

    public ArticleCollectionRepository(DSLContext db) {
        this.db = db;
    }

    public record CollectionRow(UUID id, UUID ownerId, String title, String description, String visibility,
                                long revision, OffsetDateTime createdAt, OffsetDateTime updatedAt,
                                String ownerDisplayName) {}
    public record ArticleRow(UUID id, String title, String author, String sourceUrl, String publishedAt,
                             String visibility, String tags, String coverUrl,
                             OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
    public record ArticleSource(UUID id, UUID ownerId, String visibility) {}

    public List<CollectionRow> findReadableCollections(BookKinUser viewer, String q) {
        var rows = db.fetch("""
                select c.id, c.owner_id, c.title, c.description, c.visibility, c.revision,
                       c.created_at, c.updated_at, u.display_name as owner_display_name
                  from article_collections c
                  join app_users u on u.id = c.owner_id
                 where (c.owner_id = ? or c.visibility = 'MEMBERS')
                 and (cast(? as text) is null or c.title ilike '%' || ? || '%' or c.description ilike '%' || ? || '%')
                 order by c.updated_at desc, c.id
                """, viewer.id(), q, q, q);
        return rows.map(this::collectionRow);
    }

    public CollectionRow findReadableCollection(UUID id, BookKinUser viewer) {
        var row = db.fetchOne("""
                select c.id, c.owner_id, c.title, c.description, c.visibility, c.revision,
                       c.created_at, c.updated_at, u.display_name as owner_display_name
                  from article_collections c
                  join app_users u on u.id = c.owner_id
                 where c.id = ? and (c.owner_id = ? or c.visibility = 'MEMBERS')
                """, id, viewer.id());
        return row == null ? null : collectionRow(row);
    }

    public CollectionRow findCollection(UUID id) {
        var row = db.fetchOne("""
                select c.id, c.owner_id, c.title, c.description, c.visibility, c.revision,
                       c.created_at, c.updated_at, u.display_name as owner_display_name
                  from article_collections c
                  join app_users u on u.id = c.owner_id
                 where c.id = ?
                """, id);
        return row == null ? null : collectionRow(row);
    }

    public List<ArticleRow> findVisibleArticles(CollectionRow collection, BookKinUser viewer) {
        String access = "MEMBERS".equals(collection.visibility()) && !collection.ownerId().equals(viewer.id())
                ? "a.visibility = 'PUBLIC'"
                : "(a.visibility = 'PUBLIC' or a.owner_id = ? or ? )";
        String sql = """
                select a.id, a.title, a.author, a.source_url, a.published_at, a.visibility, a.tags,
                       case when a.cover_asset_id is null then null else '/api/v1/articles/assets/' || a.cover_asset_id::text end as cover_url,
                       a.created_at, a.updated_at
                  from article_collection_articles ca
                  join articles a on a.id = ca.article_id
                 where ca.collection_id = ? and %s
                 order by ca.position, ca.article_id
                """.formatted(access);
        boolean publicOnly = "MEMBERS".equals(collection.visibility()) && !collection.ownerId().equals(viewer.id());
        var rows = publicOnly
                ? db.fetch(sql, collection.id())
                : db.fetch(sql, collection.id(), viewer.id(), viewer.canManageFiles());
        var result = new ArrayList<ArticleRow>(rows.size());
        for (var row : rows) {
            result.add(articleRow(row));
        }
        return List.copyOf(result);
    }

    public List<UUID> findRelatedIds(UUID collectionId) {
        return db.fetch("select article_id from article_collection_articles where collection_id=? order by position, article_id", collectionId)
                .getValues("article_id", UUID.class);
    }

    public List<UUID> findHiddenRelatedIds(CollectionRow collection, BookKinUser viewer) {
        boolean publicOnly = "MEMBERS".equals(collection.visibility()) && !collection.ownerId().equals(viewer.id());
        String access = publicOnly
                ? "a.visibility = 'PUBLIC'"
                : "(a.visibility = 'PUBLIC' or a.owner_id = ? or ? )";
        String sql = "select ca.article_id from article_collection_articles ca join articles a on a.id=ca.article_id "
                + "where ca.collection_id=? and not (" + access + ") order by ca.position, ca.article_id";
        return publicOnly
                ? db.fetch(sql, collection.id()).getValues("article_id", UUID.class)
                : db.fetch(sql, collection.id(), viewer.id(), viewer.canManageFiles()).getValues("article_id", UUID.class);
    }

    public List<ArticleSource> findSources(List<UUID> articleIds, BookKinUser viewer, boolean onlyPublic, boolean lock) {
        if (articleIds.isEmpty()) return List.of();
        String sql = "select id, owner_id, visibility from articles where id in (" + placeholders(articleIds.size()) + ")";
        var args = new ArrayList<Object>(articleIds);
        if (onlyPublic) sql += " and visibility='PUBLIC'";
        else {
            sql += " and (visibility='PUBLIC' or owner_id=? or ?)";
            args.add(viewer.id());
            args.add(viewer.canManageFiles());
        }
        if (lock) sql += " for share";
        return db.fetch(sql, args.toArray()).map(row -> new ArticleSource(
                row.get("id", UUID.class), row.get("owner_id", UUID.class), row.get("visibility", String.class)));
    }

    public UUID insertCollection(UUID ownerId, String title, String description, String visibility) {
        UUID id = UUID.randomUUID();
        db.execute("insert into article_collections(id,owner_id,title,description,visibility) values (?,?,?,?,?)",
                id, ownerId, title, description, visibility);
        return id;
    }

    public boolean updateCollection(UUID id, UUID ownerId, long revision, String title, String description, String visibility) {
        return db.execute("""
                update article_collections set title=?, description=?, visibility=?, revision=revision+1, updated_at=now()
                 where id=? and owner_id=? and revision=?
                """, title, description, visibility, id, ownerId, revision) == 1;
    }

    public boolean bumpRevision(UUID id, UUID ownerId, long revision) {
        return db.execute("update article_collections set revision=revision+1, updated_at=now() where id=? and owner_id=? and revision=?",
                id, ownerId, revision) == 1;
    }

    public void insertRelation(UUID collectionId, UUID articleId, int position) {
        db.execute("insert into article_collection_articles(collection_id,article_id,position) values (?,?,?)",
                collectionId, articleId, position);
    }

    public boolean deleteRelation(UUID collectionId, UUID articleId) {
        return db.execute("delete from article_collection_articles where collection_id=? and article_id=?", collectionId, articleId) == 1;
    }

    public void rewriteOrder(UUID collectionId, List<UUID> orderedIds) {
        if (orderedIds.isEmpty()) return;
        db.execute("update article_collection_articles set position=position+1001 where collection_id=?", collectionId);
        for (int index = 0; index < orderedIds.size(); index++) {
            db.execute("update article_collection_articles set position=? where collection_id=? and article_id=?",
                    index, collectionId, orderedIds.get(index));
        }
    }

    public boolean deleteCollection(UUID id, UUID ownerId, long revision) {
        return db.execute("delete from article_collections where id=? and owner_id=? and revision=?", id, ownerId, revision) == 1;
    }

    private CollectionRow collectionRow(Record row) {
        return new CollectionRow(row.get("id", UUID.class), row.get("owner_id", UUID.class),
                row.get("title", String.class), row.get("description", String.class), row.get("visibility", String.class),
                row.get("revision", Long.class), row.get("created_at", OffsetDateTime.class),
                row.get("updated_at", OffsetDateTime.class), row.get("owner_display_name", String.class));
    }

    private ArticleRow articleRow(Record row) {
        return new ArticleRow(row.get("id", UUID.class), row.get("title", String.class), row.get("author", String.class),
                row.get("source_url", String.class), row.get("published_at", String.class), row.get("visibility", String.class),
                row.get("tags", String.class), row.get("cover_url", String.class),
                row.get("created_at", OffsetDateTime.class), row.get("updated_at", OffsetDateTime.class));
    }

    private static String placeholders(int count) {
        return String.join(",", java.util.Collections.nCopies(count, "?"));
    }
}
