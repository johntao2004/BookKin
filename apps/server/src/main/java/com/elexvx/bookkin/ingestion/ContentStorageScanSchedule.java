package com.elexvx.bookkin.ingestion;

import com.elexvx.bookkin.filemanagement.ContentStorageService;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("worker")
public class ContentStorageScanSchedule {
    private final ContentStorageService scans;
    public ContentStorageScanSchedule(ContentStorageService scans) { this.scans = scans; }
    @Scheduled(fixedDelayString = "${bookkin.scan.interval:5m}", initialDelayString = "1m")
    public void scan() { scans.scanAll(); }
}
