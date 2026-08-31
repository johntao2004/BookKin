package io.github.johntao2004.bookkin.ingestion;

import java.time.OffsetDateTime;
import java.util.UUID;

public record LibraryRoot(
        UUID id,
        String name,
        String configuredPath,
        String canonicalPath,
        RootStatus status,
        boolean canRead,
        boolean canWrite,
        boolean canAtomicMove,
        boolean canStage,
        Long freeBytes,
        OffsetDateTime lastCapabilityCheckAt,
        OffsetDateTime lastScanAt) {
    public enum RootStatus { ONLINE, READ_ONLY, OFFLINE }
}
