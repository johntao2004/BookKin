// 根目录快照包含配置路径、真实路径及探测能力；能力检查时间说明其可能过期，不能替代执行时校验。
// Root snapshots retain configured/canonical paths and probed capabilities; timestamps expose staleness, so execution still validates.
package com.elexvx.bookkin.ingestion;

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
