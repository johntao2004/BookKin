package io.github.johntao2004.bookkin.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.johntao2004.bookkin.common.ApiException;
import io.github.johntao2004.bookkin.users.UserRepository;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
class CatalogOrganizationIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18-alpine");

    static DSLContext dsl;

    @BeforeAll
    static void migrate() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .load()
                .migrate();
        dsl = DSL.using(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    @Test
    void categoriesSupportCrudOrderingMultipleMembershipAndPublicFiltering() {
        UUID managerId = insertUser("category-admin", "分类管理员", "ADMIN");
        UUID publicBookId = insertBook("公开书", "公开作者", true);
        UUID privateBookId = insertBook("家庭书", "家庭作者", false);
        CategoryRepository repository = new CategoryRepository(dsl);

        var literature = repository.create("文学", "小说与散文", managerId);
        var history = repository.create("历史", "理解过去", managerId);
        var empty = repository.create("待整理", null, managerId);

        repository.replaceBookCategories(publicBookId,
                List.of(UUID.fromString(literature.id()), UUID.fromString(history.id())), managerId);
        repository.replaceBookCategories(privateBookId, List.of(UUID.fromString(history.id())), managerId);

        assertEquals(2, repository.assignedToBook(publicBookId, true).items().size());
        assertEquals(3, repository.list(null, false, true).items().size());
        assertEquals(2, repository.list(null, true, false).items().size());
        assertEquals(1, repository.find(UUID.fromString(history.id()), true, false).bookCount());
        assertEquals(2, repository.find(UUID.fromString(history.id()), false, false).bookCount());

        var renamed = repository.update(UUID.fromString(literature.id()), "文学经典", "跨越年代的文学作品");
        assertEquals("文学经典", renamed.name());
        var reordered = repository.reorder(List.of(
                UUID.fromString(empty.id()), UUID.fromString(history.id()), UUID.fromString(literature.id())));
        assertEquals("待整理", reordered.items().getFirst().name());

        repository.delete(UUID.fromString(history.id()));
        assertTrue(new BookRepository(dsl).exists(publicBookId));
        assertTrue(new BookRepository(dsl).exists(privateBookId));
        assertEquals(1, repository.assignedToBook(publicBookId, true).items().size());
    }

    @Test
    void booklistsEnforceVisibilityPublishingFilteringOwnershipAndRevisionConflicts() {
        UUID adminId = insertUser("booklist-admin", "书单管理员", "ADMIN");
        UUID creatorId = insertUser("booklist-creator", "书单作者", "MEMBER");
        insertUser("booklist-reader", "家庭读者", "MEMBER");
        UUID publicBookId = insertBook("公共目录书", "作者甲", true);
        UUID privateBookId = insertBook("私藏书", "作者乙", false);

        UserRepository users = new UserRepository(dsl);
        BooklistRepository repository = new BooklistRepository(dsl);
        BooklistService service = new BooklistService(repository, new BookRepository(dsl), users);
        Principal creator = () -> "booklist-creator";
        Principal reader = () -> "booklist-reader";
        Principal admin = () -> "booklist-admin";

        var personal = service.create(BooklistKind.PERSONAL, BooklistVisibility.PRIVATE,
                "我的路径", "只属于创建者", creator);
        personal = service.addBooks(UUID.fromString(personal.id()), List.of(publicBookId, privateBookId),
                personal.revision(), creator);

        var blockedPersonal = personal;
        ApiException publishBlocked = assertThrows(ApiException.class, () -> service.update(
                UUID.fromString(blockedPersonal.id()), blockedPersonal.title(), blockedPersonal.description(),
                BooklistVisibility.PUBLIC, blockedPersonal.revision(), creator));
        assertEquals("BOOKLIST_PUBLIC_BOOKS_REQUIRED", publishBlocked.code());
        assertTrue(publishBlocked.getMessage().contains("私藏书"));

        personal = service.removeBook(UUID.fromString(personal.id()), privateBookId, personal.revision(), creator);
        personal = service.update(UUID.fromString(personal.id()), personal.title(), personal.description(),
                BooklistVisibility.PUBLIC, personal.revision(), creator);
        long publishedRevision = personal.revision();

        var anonymous = service.get(UUID.fromString(personal.id()), null);
        assertEquals(1, anonymous.bookCount());
        assertFalse(anonymous.editable());
        assertEquals(List.of(publicBookId.toString()), service.books(UUID.fromString(personal.id()),
                null, null, null, 20, null).items().stream().map(BrowseBook::id).toList());

        dsl.execute("delete from display_catalog_entries where book_id = ?", publicBookId);
        var filteredAnonymous = service.get(UUID.fromString(personal.id()), null);
        assertEquals(0, filteredAnonymous.bookCount());
        assertTrue(filteredAnonymous.previewBooks().isEmpty());
        assertEquals(1, service.get(UUID.fromString(personal.id()), creator).hiddenPublicBookCount());

        var family = service.create(BooklistKind.PERSONAL, BooklistVisibility.MEMBERS,
                "家庭共读", null, creator);
        assertFalse(service.get(UUID.fromString(family.id()), reader).editable());
        ApiException familyEdit = assertThrows(ApiException.class, () -> service.update(
                UUID.fromString(family.id()), family.title(), null, BooklistVisibility.MEMBERS,
                family.revision(), reader));
        assertEquals(403, familyEdit.status().value());

        var privateList = service.create(BooklistKind.PERSONAL, BooklistVisibility.PRIVATE,
                "创建者私密", null, creator);
        ApiException hiddenFromAdmin = assertThrows(ApiException.class,
                () -> service.get(UUID.fromString(privateList.id()), admin));
        assertEquals(404, hiddenFromAdmin.status().value());

        ApiException memberOfficial = assertThrows(ApiException.class, () -> service.create(
                BooklistKind.OFFICIAL, BooklistVisibility.PUBLIC, "越权官方书单", null, creator));
        assertEquals(403, memberOfficial.status().value());
        assertTrue(service.create(BooklistKind.OFFICIAL, BooklistVisibility.PUBLIC,
                "官方精选", null, admin).editable());

        var reordered = service.reorder(UUID.fromString(personal.id()), List.of(publicBookId),
                publishedRevision, creator);
        ApiException staleUpdate = assertThrows(ApiException.class, () -> service.update(
                UUID.fromString(reordered.id()), reordered.title(), reordered.description(),
                BooklistVisibility.PRIVATE, publishedRevision, creator));
        assertEquals("BOOKLIST_CHANGED", staleUpdate.code());

        assertTrue(new BookRepository(dsl).exists(publicBookId));
        assertTrue(new BookRepository(dsl).exists(privateBookId));
        assertEquals(adminId, users.findByUsername("booklist-admin").orElseThrow().id());
        assertEquals(creatorId, users.findByUsername("booklist-creator").orElseThrow().id());
    }

    private static UUID insertUser(String username, String displayName, String role) {
        UUID id = UUID.randomUUID();
        dsl.execute("""
                insert into app_users(id, username, display_name, password_hash, role, must_change_password)
                values (?, ?, ?, 'test-password-hash', ?, false)
                """, id, username, displayName, role);
        return id;
    }

    private static UUID insertBook(String title, String author, boolean publicBook) {
        UUID bookId = UUID.randomUUID();
        UUID rootId = UUID.randomUUID();
        UUID fileId = UUID.randomUUID();
        dsl.execute("insert into library_roots(id, name, configured_path) values (?, ?, ?)",
                rootId, "root-" + rootId, "/tmp/" + rootId);
        dsl.execute("insert into books(id, title, sort_title, primary_author) values (?, ?, ?, ?)",
                bookId, title, title, author);
        dsl.execute("""
                insert into book_files(id, book_id, library_root_id, relative_path, normalized_path,
                  format, status, size_bytes, modified_at, fingerprint, quick_fingerprint)
                values (?, ?, ?, ?, ?, 'EPUB', 'AVAILABLE', 1024, ?::timestamptz, ?, ?)
                """, fileId, bookId, rootId, title + ".epub", title + ".epub", OffsetDateTime.now(),
                "sha256:" + bookId, "quick:" + bookId);
        if (publicBook) {
            dsl.execute("insert into display_catalog_entries(catalog_id, book_id, sort_order) values (1, ?, ?)",
                    bookId, System.nanoTime());
        }
        return bookId;
    }
}
