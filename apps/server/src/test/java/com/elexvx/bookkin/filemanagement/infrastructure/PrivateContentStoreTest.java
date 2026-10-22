package com.elexvx.bookkin.filemanagement.infrastructure;

import java.io.ByteArrayInputStream;
import java.nio.file.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.assertj.core.api.Assertions.*;

class PrivateContentStoreTest {
    @TempDir Path temporary;
    PrivateContentStore store() throws Exception {
        return new PrivateContentStore(temporary.toRealPath().resolve("content").toString(), "", "");
    }
    @Test void keepsIdenticalObjectIdsIndependentBetweenAreasAndUsers() throws Exception {
        var store = store(); store.initialize();
        var owner = UUID.randomUUID(); var other = UUID.randomUUID(); var id = UUID.randomUUID();
        store.create("articles", owner, id, new ByteArrayInputStream(new byte[]{1}), 10);
        store.create("vault", owner, id, new ByteArrayInputStream(new byte[]{2}), 10);
        store.create("articles", other, id, new ByteArrayInputStream(new byte[]{3}), 10);
        store.delete("articles", owner, id);
        assertThat(store.resource("vault", owner, id).getContentAsByteArray()).containsExactly(2);
        assertThat(store.resource("articles", other, id).getContentAsByteArray()).containsExactly(3);
        assertThat(store.resource("articles", owner, id).exists()).isFalse();
    }
    @Test void rejectsOverwriteAndCleansFailedStagingBeforeRetry() throws Exception {
        var store = store(); var owner = UUID.randomUUID(); var id = UUID.randomUUID();
        assertThatThrownBy(() -> store.create("vault", owner, id, new ByteArrayInputStream(new byte[]{1,2}), 1)).isInstanceOf(java.io.IOException.class);
        store.create("vault", owner, id, new ByteArrayInputStream(new byte[]{3}), 1);
        assertThatThrownBy(() -> store.create("vault", owner, id, new ByteArrayInputStream(new byte[]{4}), 1)).isInstanceOf(FileAlreadyExistsException.class);
        assertThat(store.resource("vault", owner, id).getContentAsByteArray()).containsExactly(3);
        try (var paths = Files.list(store.resource("vault", owner, id).getFile().toPath().getParent())) {
            assertThat(paths.map(path -> path.getFileName().toString()).toList()).containsExactly(id.toString());
        }
    }
    @Test void rejectsNestedAreasRelativeOverridesAndSymbolicLinksBeforeWriting() throws Exception {
        Path base = temporary.toRealPath();
        assertThatThrownBy(() -> new PrivateContentStore(base.toString(), base.resolve("same").toString(), base.resolve("same/vault").toString())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PrivateContentStore(base.toString(), "relative", "")).isInstanceOf(IllegalArgumentException.class);
        Path outside = Files.createDirectory(base.resolve("outside"));
        Path link = Files.createSymbolicLink(base.resolve("link"), outside);
        var store = new PrivateContentStore(base.resolve("content").toString(), link.resolve("articles").toString(), "");
        assertThatThrownBy(store::initialize).isInstanceOf(java.io.IOException.class);
        try (var paths = Files.list(outside)) { assertThat(paths.count()).isZero(); }
    }
    @Test void explicitLocationsDoNotMixFilesOrPermitBookRegistration() throws Exception {
        Path base = temporary.toRealPath();
        var store = new PrivateContentStore(base.resolve("legacy").toString(), base.resolve("article-library").toString(), base.resolve("vault-library").toString());
        store.initialize();
        assertThat(store.locations()).extracting(PrivateContentStore.StorageArea::kind).containsExactly("ARTICLES", "VAULT");
        assertThat(store.overlaps(base)).isTrue();
        assertThat(store.overlaps(base.resolve("vault-library/user"))).isTrue();
        Path books = Files.createDirectory(base.resolve("books"));
        var probe = new LibraryLocationProbe(base.toString(), store);
        assertThat(probe.inspect(books.toString()).path()).isEqualTo(books.toString());
        assertThatThrownBy(() -> probe.inspect(base.resolve("article-library").toString())).hasMessageContaining("不能");
        assertThatThrownBy(() -> probe.inspect(base.resolve("vault-library").toString())).hasMessageContaining("不能");
    }
    @Test void metadataScanIsReadOnlyAndRejectsLinksWithoutFollowingThem() throws Exception {
        var store = store(); store.initialize();
        Path vault = temporary.toRealPath().resolve("content/vault");
        Path object = Files.write(vault.resolve("ciphertext"), new byte[]{1,2,3});
        store.scan("VAULT");
        assertThat(Files.readAllBytes(object)).containsExactly(1,2,3);
        Path outside = Files.createDirectory(temporary.toRealPath().resolve("outside"));
        Files.createSymbolicLink(vault.resolve("unsafe"), outside);
        assertThatThrownBy(() -> store.scan("VAULT")).isInstanceOf(java.io.IOException.class);
        try (var paths = Files.list(outside)) { assertThat(paths.count()).isZero(); }
    }
}
