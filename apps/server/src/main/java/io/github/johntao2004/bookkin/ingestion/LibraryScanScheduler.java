package io.github.johntao2004.bookkin.ingestion;

import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.launch.JobOperator;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("worker")
public class LibraryScanScheduler {
    private static final Logger log = LoggerFactory.getLogger(LibraryScanScheduler.class);
    private final JobOperator operator;
    private final Job libraryScanJob;

    public LibraryScanScheduler(JobOperator operator, Job libraryScanJob) {
        this.operator = operator;
        this.libraryScanJob = libraryScanJob;
    }

    @Scheduled(fixedDelayString = "${page.scan.interval:5m}", initialDelayString = "10s")
    public void launch() {
        try {
            operator.start(libraryScanJob, new JobParametersBuilder().addLong("launchedAt", Instant.now().toEpochMilli()).toJobParameters());
        } catch (Exception exception) {
            log.error("Unable to launch library scan job", exception);
        }
    }
}
