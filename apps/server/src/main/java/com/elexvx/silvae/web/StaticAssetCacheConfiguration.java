package com.elexvx.silvae.web;

import java.time.Duration;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Gives only Vite's eight-character hashed JavaScript and CSS bundles long-lived public caching. */
@Configuration
@Profile("api")
public class StaticAssetCacheConfiguration implements WebMvcConfigurer {
    private static final String HASHED_FILENAME = "[A-Za-z0-9._-]+-[A-Za-z0-9_-]"
            + "[A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-]"
            + "[A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-][A-Za-z0-9_-]";
    private static final CacheControl HASHED_BUILD_CACHE = CacheControl.maxAge(Duration.ofDays(365))
            .cachePublic()
            .immutable();

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registerHashedBuildAssets(registry, ".js");
        registerHashedBuildAssets(registry, ".css");
    }

    private static void registerHashedBuildAssets(ResourceHandlerRegistry registry, String extension) {
        registry.addResourceHandler("/assets/{filename:" + HASHED_FILENAME + "}" + extension)
                .addResourceLocations("classpath:/static/assets/")
                .setCacheControl(HASHED_BUILD_CACHE);
    }
}
