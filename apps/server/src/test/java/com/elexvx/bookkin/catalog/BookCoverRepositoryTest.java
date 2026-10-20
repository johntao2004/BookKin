// 覆盖确认重置、失败重试、重新启用和幂等清理，避免过期记录误删重新使用的封面。
// Covers confirmed reset, retry, reactivation and idempotent cleanup without deleting a reused cover.
package com.elexvx.bookkin.catalog;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.junit.jupiter.api.Test;

class BookCoverRepositoryTest {
    final DSLContext db = mock(DSLContext.class);
    final BookCoverRepository covers = new BookCoverRepository(db);
    final UUID book = UUID.randomUUID();
    final UUID id = UUID.randomUUID();
    final BookCoverRepository.ExpiredCoverAsset asset = new BookCoverRepository.ExpiredCoverAsset(id, book, UUID.randomUUID(), ".bookkin-assets/covers/test.jpg", "sha256:test");

    @Test void confirmedResetExpiresTheUploadedAssetImmediately() {
        Record current = mock(Record.class);
        when(db.fetchOne("select cover_asset_id from books where id = ?", book)).thenReturn(current);
        when(current.get(0, UUID.class)).thenReturn(id);
        covers.reset(book);
        verify(db).execute("update books set cover_asset_id = null, updated_at = now() where id = ?", book);
        verify(db).execute("update book_cover_assets set retired_at = now(), expires_at = now() where id = ?", id);
    }
    @Test void reactivatedOrAlreadyRemovedAssetDoesNotDeleteAFile() {
        Runnable remove = mock(Runnable.class);
        assertFalse(covers.purgeExpired(asset, remove));
        verifyNoInteractions(remove);
    }
    @Test void failedFileCleanupKeepsTheAssetForRetry() {
        when(db.fetchOne(anyString(), eq(id), eq(asset.fingerprint()))).thenReturn(mock(Record.class));
        assertThrows(IllegalStateException.class, () -> covers.purgeExpired(asset, () -> { throw new IllegalStateException("conflict"); }));
        verify(db, never()).execute("delete from book_cover_assets where id = ?", id);
    }
    @Test void successfulCleanupIsIdempotent() {
        when(db.fetchOne(anyString(), eq(id), eq(asset.fingerprint()))).thenReturn(mock(Record.class)).thenReturn((Record) null);
        Runnable remove = mock(Runnable.class);
        assertTrue(covers.purgeExpired(asset, remove));
        assertFalse(covers.purgeExpired(asset, remove));
        verify(remove).run();
        verify(db).execute("delete from book_cover_assets where id = ?", id);
    }
}
