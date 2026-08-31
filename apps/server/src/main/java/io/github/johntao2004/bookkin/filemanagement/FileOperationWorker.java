package io.github.johntao2004.bookkin.filemanagement;

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

    @Scheduled(fixedDelayString = "${page.worker.poll-delay:1s}")
    public void poll() {
        operations.claimNext().ifPresent(executor::execute);
    }
}
