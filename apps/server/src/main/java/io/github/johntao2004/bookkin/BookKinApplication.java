package io.github.johntao2004.bookkin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@ConfigurationPropertiesScan
@SpringBootApplication
public class BookKinApplication {
    public static void main(String[] args) {
        SpringApplication.run(BookKinApplication.class, args);
    }
}
