package com.elexvx.bookkin.config;

import java.util.concurrent.Executor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@EnableAsync
@Configuration
public class UploadAsyncConfig {
    // 解析执行器固定两线程且队列有上限；与 HTTP 上传传输并发是不同层次。
    // The parsing executor has two threads and a bounded queue; this is separate from HTTP upload concurrency.
    @Bean("bookUploadExecutor")
    Executor bookUploadExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("book-upload-");
        executor.initialize();
        return executor;
    }
}
