package io.github.johntao2004.bookkin.ingestion;

import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.Step;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
@Profile("worker")
public class LibraryScanBatchConfiguration {
    @Bean
    Step libraryScanStep(JobRepository jobRepository, PlatformTransactionManager transactionManager,
                         LibraryScanCoordinator coordinator) {
        return new StepBuilder("libraryScanStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    var summary = coordinator.scanAll();
                    contribution.getStepExecution().setReadCount(summary.seen());
                    contribution.getStepExecution().setWriteCount(summary.changed());
                    contribution.getStepExecution().setReadSkipCount(summary.failed());
                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }

    @Bean
    Job libraryScanJob(JobRepository jobRepository, Step libraryScanStep) {
        return new JobBuilder("libraryScanJob", jobRepository).start(libraryScanStep).build();
    }
}
