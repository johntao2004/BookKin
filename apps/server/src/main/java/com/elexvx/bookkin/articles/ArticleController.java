package com.elexvx.bookkin.articles;
import java.security.Principal;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController @Profile("api") @RequestMapping("/api/v1/articles")
// 文章 HTTP 适配层，把认证身份交给服务处理可见性、导入及私人阅读状态。
// HTTP adapter for articles; passes identity to the service for visibility, imports and private reading state.
public class ArticleController {
 private final ArticleService service;
 public ArticleController(ArticleService service){this.service=service;}
 @GetMapping public Object list(Principal p){return service.list(p);}
 @PostMapping("/fetch") public Object fetch(@Valid @RequestBody Fetch input,Principal p){return service.fetch(input.url(),p);}
 @GetMapping("/knowledge") public Object knowledge(Principal p){return service.knowledge(p);}
 @GetMapping("/{id}") public Object get(@PathVariable UUID id,Principal p){return service.get(id,p);}
 @PostMapping public Object create(@Valid @RequestBody ArticleService.Draft input,Principal p){return service.save(null,input,p);}
 @PutMapping("/{id}") public Object update(@PathVariable UUID id,@Valid @RequestBody ArticleService.Draft input,Principal p){return service.save(id,input,p);}
 @PostMapping("/prepare") @PreAuthorize("hasAnyRole('OWNER','ADMIN')") public Prepared prepare(@Valid @RequestBody Prepare input,Principal p){return new Prepared(service.prepare(input.html(),input.sourceUrl(),p));}
 @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable UUID id,Principal p){service.delete(id,p);return ResponseEntity.noContent().build();}
 @GetMapping("/{id}/reading") public Object reading(@PathVariable UUID id,Principal p){return service.reading(id,p);}
 @PutMapping("/{id}/reading") public ResponseEntity<Void> reading(@PathVariable UUID id,@RequestBody Reading input,Principal p){service.reading(id,input.state(),input.revision(),p);return ResponseEntity.noContent().build();}
 @PostMapping("/{id}/knowledge") public ResponseEntity<Void> generate(@PathVariable UUID id,Principal p)throws Exception{service.generate(id,p);return ResponseEntity.noContent().build();}
 @GetMapping("/assets/{id}") public ResponseEntity<org.springframework.core.io.Resource> image(@PathVariable UUID id,Principal p)throws Exception{
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.IMAGE_PNG).header("X-Content-Type-Options","nosniff").body(service.image(id,p));
 }
 public record Fetch(@NotBlank @Size(max=4096) String url){}
 public record Prepare(@NotNull @Size(max=30000000) String html,@NotNull @Size(max=4096) String sourceUrl){}
 public record Prepared(String html){}
 public record Reading(@NotNull @Size(max=1000000) String state,long revision){}
}
