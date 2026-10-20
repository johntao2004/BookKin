package com.elexvx.bookkin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

// API 与 Worker 共用启动入口；各组件通过 Profile 决定是否加载。
// API and worker share this entry point; component profiles decide what is loaded.
@EnableScheduling
@ConfigurationPropertiesScan
@SpringBootApplication
public class BookKinApplication {
    public static void main(String[] args) {
        SpringApplication.run(BookKinApplication.class, args);
    }
}
