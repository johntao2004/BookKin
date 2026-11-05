package com.elexvx.silvae.ingestion;

import com.elexvx.silvae.filemanagement.ContentStorageService;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("worker")
public class ContentStorageScanSchedule {
    private final ContentStorageService scans;
    public ContentStorageScanSchedule(ContentStorageService scans) { this.scans = scans; }
    @Scheduled(fixedDelayString = "${silvae.scan.interval:5m}", initialDelayString = "1m")
    public void scan() { scans.scanAll(); }
}
