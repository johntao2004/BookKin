package com.elexvx.bookkin.filemanagement;

import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("worker")
public class FileOperationWorker {
    private final FileOperationRepository operations;
    private final FileTransactionExecutor executor;

    public FileOperationWorker(FileOperationRepository operations, FileTransactionExecutor executor) {
        this.operations = operations;
        this.executor = executor;
    }

    // 仅 worker Profile 轮询领取任务；调度键以本注解的 page.worker 为准。
    // Only the worker profile polls for jobs; the scheduling key here is page.worker as written in this annotation.
    @Scheduled(fixedDelayString = "${page.worker.poll-delay:1s}")
    public void poll() {
        operations.claimNext().ifPresent(executor::execute);
    }
}
