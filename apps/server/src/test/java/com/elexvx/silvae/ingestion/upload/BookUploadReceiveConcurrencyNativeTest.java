package com.elexvx.silvae.ingestion.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.elexvx.silvae.audit.AuditService;
import com.elexvx.silvae.catalog.BookFormat;
import com.elexvx.silvae.catalog.DisplayCatalogService;
import com.elexvx.silvae.common.ApiException;
import com.elexvx.silvae.config.SilvaeProperties;
import com.elexvx.silvae.filemanagement.FileFingerprints;
import com.elexvx.silvae.filemanagement.PathPolicy;
import com.elexvx.silvae.ingestion.CatalogIngestionRepository;
import com.elexvx.silvae.ingestion.LibraryRoot;
import com.elexvx.silvae.ingestion.LibraryRootRepository;
import com.elexvx.silvae.users.SilvaeUser;
import com.elexvx.silvae.users.UserRepository;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.flywaydb.core.Flyway;
import org.jooq.DSLContext;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.ObjectMapper;

@EnabledIfEnvironmentVariable(named = "SILVAE_NATIVE_TEST_URL", matches = ".+")
class BookUploadReceiveConcurrencyNativeTest {
    private static final String OWNER_USERNAME = "native-upload-owner";

    @Test
    void concurrentReceiveClaimsOnlyOneWriterAndPreservesItsFile(@TempDir Path rootPath) throws Exception {
        String url = System.getenv("SILVAE_NATIVE_TEST_URL");
        String user = System.getenv().getOrDefault("SILVAE_NATIVE_TEST_USER", System.getProperty("user.name"));
        String password = System.getenv().getOrDefault("SILVAE_NATIVE_TEST_PASSWORD", "");
        String schema = "silvae_upload_receive_" + UUID.randomUUID().toString().replace("-", "");

        try (Connection admin = DriverManager.getConnection(url, user, password);
                var statement = admin.createStatement()) {
            statement.execute("create schema " + schema);
            try {
                Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema)
                        .locations("classpath:db/migration").load().migrate();
                UUID ownerId = UUID.randomUUID();
                UUID rootId = UUID.randomUUID();
                try (Connection firstConnection = connect(url, user, password, schema);
                        Connection secondConnection = connect(url, user, password, schema);
                        Connection observerConnection = connect(url, user, password, schema)) {
                    DSLContext firstDb = DSL.using(firstConnection, SQLDialect.POSTGRES);
                    DSLContext secondDb = DSL.using(secondConnection, SQLDialect.POSTGRES);
                    DSLContext observerDb = DSL.using(observerConnection, SQLDialect.POSTGRES);
                    insertOwner(firstDb, ownerId);
                    firstDb.execute("insert into library_roots(id,name,configured_path) values (?,?,?)",
                            rootId, "receive-root", rootPath.toRealPath().toString());

                    var json = new ObjectMapper();
                    var attempts = new CountDownLatch(2);
                    var successfulClaims = new AtomicInteger();
                    var firstUploads = new TrackingBookUploadRepository(firstDb, json, attempts, successfulClaims);
                    var secondUploads = new TrackingBookUploadRepository(secondDb, json, attempts, successfulClaims);
                    var observerUploads = new BookUploadRepository(observerDb, json);
                    UUID uploadId = UUID.randomUUID();
                    byte[] firstPayload = "first-request-content".getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    byte[] secondPayload = "other-request-content".getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    assertThat(secondPayload).hasSize(firstPayload.length);
                    firstUploads.create(uploadId, ownerId, rootId, "race.epub",
                            ".silvae-staging/uploads/" + uploadId + "/book.part", BookFormat.EPUB,
                            firstPayload.length, OffsetDateTime.now().plusHours(1));

                    CyclicBarrier bothPassedInitialStateCheck = new CyclicBarrier(2);
                    AtomicInteger rootLookups = new AtomicInteger();
                    var roots = mock(LibraryRootRepository.class);
                    when(roots.findById(rootId)).thenAnswer(ignored -> {
                        if (rootLookups.incrementAndGet() <= 2) bothPassedInitialStateCheck.await(10, TimeUnit.SECONDS);
                        return Optional.of(onlineRoot(rootId, rootPath));
                    });
                    var userEntity = mock(SilvaeUser.class);
                    when(userEntity.id()).thenReturn(ownerId);
                    var users = mock(UserRepository.class);
                    when(users.findByUsername(OWNER_USERNAME)).thenReturn(Optional.of(userEntity));
                    var processor = mock(BookUploadProcessor.class);
                    var firstService = service(firstUploads, firstDb, roots, users, processor);
                    var secondService = service(secondUploads, secondDb, roots, users, processor);

                    CountDownLatch firstChunkWritten = new CountDownLatch(1);
                    CountDownLatch allowStreamsToFinish = new CountDownLatch(1);
                    var firstInput = new BlockingInputStream(firstPayload, firstChunkWritten, allowStreamsToFinish);
                    var secondInput = new BlockingInputStream(secondPayload, firstChunkWritten, allowStreamsToFinish);
                    ExecutorService executor = Executors.newFixedThreadPool(2);
                    Future<BookUploadModels.BookUpload> firstRequest = executor.submit(
                            () -> firstService.receive(uploadId, firstPayload.length, firstInput, () -> OWNER_USERNAME));
                    Future<BookUploadModels.BookUpload> secondRequest = executor.submit(
                            () -> secondService.receive(uploadId, secondPayload.length, secondInput, () -> OWNER_USERNAME));
                    try {
                        assertThat(firstChunkWritten.await(10, TimeUnit.SECONDS)).isTrue();
                        assertThat(attempts.await(10, TimeUnit.SECONDS)).isTrue();
                        assertThat(successfulClaims.get()).isEqualTo(1);

                        BlockingInputStream winnerInput = firstInput.readCount() > 0 ? firstInput : secondInput;
                        Future<BookUploadModels.BookUpload> winnerRequest = winnerInput == firstInput ? firstRequest : secondRequest;
                        Future<BookUploadModels.BookUpload> losingRequest = winnerInput == firstInput ? secondRequest : firstRequest;
                        assertConflict(losingRequest);

                        Path staged = rootPath.resolve(".silvae-staging/uploads/" + uploadId + "/book.part");
                        assertThat(Files.exists(staged)).isTrue();
                        assertThat(Files.readAllBytes(staged)).containsExactly(winnerInput.payloadPrefix());
                        var inProgress = observerUploads.findOwned(uploadId, ownerId).orElseThrow();
                        assertThat(inProgress.status()).isEqualTo(BookUploadModels.BookUploadStatus.INSPECTING);
                        assertThat(inProgress.receivedBytes()).isZero();
                        assertThat(inProgress.fingerprint()).isNull();
                        assertThat(inProgress.errorCode()).isNull();
                        assertThatThrownBy(() -> secondService.cancel(uploadId, () -> OWNER_USERNAME))
                                .isInstanceOfSatisfying(ApiException.class,
                                        exception -> assertThat(exception.status().value()).isEqualTo(409));
                        assertThat(Files.exists(staged)).isTrue();

                        allowStreamsToFinish.countDown();
                        var completed = winnerRequest.get(10, TimeUnit.SECONDS);
                        byte[] expectedPayload = winnerInput.payload();
                        assertThat(Files.readAllBytes(staged)).containsExactly(expectedPayload);
                        assertThat(completed.status()).isEqualTo(BookUploadModels.BookUploadStatus.INSPECTING);
                        assertThat(completed.receivedBytes()).isEqualTo(expectedPayload.length);
                        assertThat(completed.fingerprint()).isEqualTo(new FileFingerprints().sha256(staged));
                        assertThat(winnerInput.readCount()).isGreaterThan(0);
                        assertThat((winnerInput == firstInput ? secondInput : firstInput).readCount()).isZero();
                        verify(processor, times(1)).process(uploadId);

                        UUID failedUploadId = UUID.randomUUID();
                        firstUploads.create(failedUploadId, ownerId, rootId, "short.epub",
                                ".silvae-staging/uploads/" + failedUploadId + "/book.part", BookFormat.EPUB,
                                8, OffsetDateTime.now().plusHours(1));
                        Path failedStaged = rootPath.resolve(".silvae-staging/uploads/" + failedUploadId + "/book.part");
                        assertThatThrownBy(() -> firstService.receive(failedUploadId, 8,
                                new java.io.ByteArrayInputStream("short".getBytes(java.nio.charset.StandardCharsets.UTF_8)),
                                () -> OWNER_USERNAME))
                                .isInstanceOfSatisfying(ApiException.class,
                                        exception -> assertThat(exception.status().value()).isEqualTo(400));
                        assertThat(Files.exists(failedStaged)).isFalse();
                        var failed = observerUploads.findOwned(failedUploadId, ownerId).orElseThrow();
                        assertThat(failed.status()).isEqualTo(BookUploadModels.BookUploadStatus.FAILED);
                        assertThat(failed.errorCode()).isEqualTo("UPLOAD_FAILED");
                        assertThat(failed.receivedBytes()).isZero();
                        assertThat(failed.fingerprint()).isNull();
                        assertThatThrownBy(() -> secondService.receive(failedUploadId, 8,
                                new java.io.ByteArrayInputStream("retry!!".getBytes(java.nio.charset.StandardCharsets.UTF_8)),
                                () -> OWNER_USERNAME))
                                .isInstanceOfSatisfying(ApiException.class,
                                        exception -> assertThat(exception.status().value()).isEqualTo(409));
                        assertThat(observerUploads.findOwned(failedUploadId, ownerId).orElseThrow().status())
                                .isEqualTo(BookUploadModels.BookUploadStatus.FAILED);
                    } finally {
                        allowStreamsToFinish.countDown();
                        executor.shutdownNow();
                    }

                    UUID cancelWinsUploadId = UUID.randomUUID();
                    byte[] cancelWinsPayload = "cancel-before-receive-claim".getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    firstUploads.create(cancelWinsUploadId, ownerId, rootId, "cancel-race.epub",
                            ".silvae-staging/uploads/" + cancelWinsUploadId + "/book.part", BookFormat.EPUB,
                            cancelWinsPayload.length, OffsetDateTime.now().plusHours(1));
                    var receiveAtRoot = new CountDownLatch(1);
                    var releaseReceive = new CountDownLatch(1);
                    var raceRootLookups = new AtomicInteger();
                    var raceRoots = mock(LibraryRootRepository.class);
                    when(raceRoots.findById(rootId)).thenAnswer(ignored -> {
                        if (raceRootLookups.incrementAndGet() == 1) {
                            receiveAtRoot.countDown();
                            if (!releaseReceive.await(10, TimeUnit.SECONDS)) throw new AssertionError("receive was not released");
                        }
                        return Optional.of(onlineRoot(rootId, rootPath));
                    });
                    var raceService = service(firstUploads, firstDb, raceRoots, users, processor);
                    ExecutorService raceExecutor = Executors.newSingleThreadExecutor();
                    try {
                        Future<BookUploadModels.BookUpload> receiveAfterCancel = raceExecutor.submit(() -> raceService.receive(
                                cancelWinsUploadId, cancelWinsPayload.length,
                                new java.io.ByteArrayInputStream(cancelWinsPayload), () -> OWNER_USERNAME));
                        assertThat(receiveAtRoot.await(10, TimeUnit.SECONDS)).isTrue();
                        raceService.cancel(cancelWinsUploadId, () -> OWNER_USERNAME);
                        assertThat(observerUploads.findOwned(cancelWinsUploadId, ownerId).orElseThrow().status())
                                .isEqualTo(BookUploadModels.BookUploadStatus.CANCELLED);
                        releaseReceive.countDown();
                        assertConflict(receiveAfterCancel);
                        Path cancelledStaged = rootPath.resolve(".silvae-staging/uploads/" + cancelWinsUploadId + "/book.part");
                        assertThat(Files.exists(cancelledStaged)).isFalse();
                        assertThat(observerUploads.findOwned(cancelWinsUploadId, ownerId).orElseThrow().status())
                                .isEqualTo(BookUploadModels.BookUploadStatus.CANCELLED);
                        raceService.cancel(cancelWinsUploadId, () -> OWNER_USERNAME);
                        assertThat(observerUploads.findOwned(cancelWinsUploadId, ownerId).orElseThrow().status())
                                .isEqualTo(BookUploadModels.BookUploadStatus.CANCELLED);

                        UUID cleanupRetryUploadId = UUID.randomUUID();
                        firstUploads.create(cleanupRetryUploadId, ownerId, rootId, "cleanup-retry.epub",
                                ".silvae-staging/uploads/" + cleanupRetryUploadId + "/book.part", BookFormat.EPUB,
                                12, OffsetDateTime.now().plusHours(1));
                        Path cleanupDirectory = rootPath.resolve(".silvae-staging/uploads/" + cleanupRetryUploadId);
                        Path unexpectedDirectory = cleanupDirectory.resolve("unexpected");
                        Files.createDirectories(unexpectedDirectory.resolve("nested"));
                        assertThatThrownBy(() -> raceService.cancel(cleanupRetryUploadId, () -> OWNER_USERNAME))
                                .isInstanceOfSatisfying(ApiException.class, exception -> {
                                    assertThat(exception.status().value()).isEqualTo(500);
                                    assertThat(exception.code()).isEqualTo("UPLOAD_CLEANUP_FAILED");
                                });
                        assertThat(observerUploads.findOwned(cleanupRetryUploadId, ownerId).orElseThrow().status())
                                .isEqualTo(BookUploadModels.BookUploadStatus.CANCELLED);
                        Files.delete(unexpectedDirectory.resolve("nested"));
                        Files.delete(unexpectedDirectory);
                        raceService.cancel(cleanupRetryUploadId, () -> OWNER_USERNAME);
                        assertThat(Files.exists(cleanupDirectory)).isFalse();
                    } finally {
                        releaseReceive.countDown();
                        raceExecutor.shutdownNow();
                    }
                }
            } finally {
                statement.execute("drop schema " + schema + " cascade");
            }
        }
    }

    private static Connection connect(String url, String user, String password, String schema) throws Exception {
        Connection connection = DriverManager.getConnection(url, user, password);
        try (var statement = connection.createStatement()) {
            statement.execute("set search_path to " + schema + ",public");
        }
        return connection;
    }

    private static void insertOwner(DSLContext db, UUID ownerId) {
        db.execute("insert into app_users(id,username,display_name,password_hash,role) values (?,?,?,'native-test','OWNER')",
                ownerId, OWNER_USERNAME, OWNER_USERNAME);
    }

    private static LibraryRoot onlineRoot(UUID id, Path path) {
        return new LibraryRoot(id, "receive-root", path.toString(), path.toString(), LibraryRoot.RootStatus.ONLINE,
                true, true, true, true, null, null, null);
    }

    private static BookUploadService service(BookUploadRepository uploads, DSLContext db, LibraryRootRepository roots,
            UserRepository users, BookUploadProcessor processor) {
        return new BookUploadService(uploads, processor, null, null, null, roots, new CatalogIngestionRepository(db),
                users, null, new FileFingerprints(), new PathPolicy(),
                new SilvaeProperties(null, null, null, null, null, null, null, null, null, null, null),
                mock(AuditService.class), new ObjectMapper(), mock(DisplayCatalogService.class), null, null);
    }

    private static void assertConflict(Future<?> future) throws Exception {
        try {
            future.get(10, TimeUnit.SECONDS);
            throw new AssertionError("Concurrent receive should be rejected");
        } catch (ExecutionException exception) {
            assertThat(exception.getCause()).isInstanceOf(ApiException.class);
            ApiException apiException = (ApiException) exception.getCause();
            assertThat(apiException.status().value()).isEqualTo(409);
            assertThat(apiException.code()).isEqualTo("UPLOAD_STATE");
        }
    }

    private static final class TrackingBookUploadRepository extends BookUploadRepository {
        private final CountDownLatch attempts;
        private final AtomicInteger successfulClaims;

        private TrackingBookUploadRepository(DSLContext db, ObjectMapper json, CountDownLatch attempts,
                AtomicInteger successfulClaims) {
            super(db, json);
            this.attempts = attempts;
            this.successfulClaims = successfulClaims;
        }

        @Override
        public boolean claimReceiving(UUID id, UUID actorId) {
            boolean claimed = super.claimReceiving(id, actorId);
            if (claimed) successfulClaims.incrementAndGet();
            attempts.countDown();
            return claimed;
        }
    }

    private static final class BlockingInputStream extends InputStream {
        private final byte[] payload;
        private final CountDownLatch firstChunkWritten;
        private final CountDownLatch allowFinish;
        private final int prefixLength;
        private int cursor;
        private int reads;

        private BlockingInputStream(byte[] payload, CountDownLatch firstChunkWritten, CountDownLatch allowFinish) {
            this.payload = payload;
            this.firstChunkWritten = firstChunkWritten;
            this.allowFinish = allowFinish;
            this.prefixLength = Math.min(7, payload.length);
        }

        @Override
        public int read() throws IOException {
            byte[] one = new byte[1];
            int read = read(one, 0, 1);
            return read < 0 ? -1 : one[0] & 0xff;
        }

        @Override
        public int read(byte[] bytes, int offset, int length) throws IOException {
            reads++;
            if (cursor == 0) {
                System.arraycopy(payload, 0, bytes, offset, prefixLength);
                cursor = prefixLength;
                return prefixLength;
            }
            if (cursor == prefixLength) {
                firstChunkWritten.countDown();
                try {
                    if (!allowFinish.await(10, TimeUnit.SECONDS)) throw new IOException("test timed out waiting to finish stream");
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new IOException("test stream interrupted", exception);
                }
                int remaining = payload.length - cursor;
                System.arraycopy(payload, cursor, bytes, offset, remaining);
                cursor += remaining;
                return remaining;
            }
            return -1;
        }

        private int readCount() { return reads; }
        private byte[] payload() { return payload.clone(); }
        private byte[] payloadPrefix() { return java.util.Arrays.copyOf(payload, prefixLength); }
    }
}
