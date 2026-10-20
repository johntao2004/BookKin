package com.elexvx.bookkin.vault;
import java.security.Principal;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import jakarta.servlet.http.HttpServletRequest;

@RestController @Profile("api") @RequestMapping("/api/v1/vault")
// 传递密文信封、分块和 revision；身份隔离及存储规则交给 VaultService。
// Transfers ciphertext envelopes, chunks and revisions while VaultService enforces identity isolation and storage rules.
public class VaultController {
 private final VaultService service;public VaultController(VaultService service){this.service=service;}
 @GetMapping("/config") public Object config(Principal p){return service.config(p);}
 @PutMapping("/config") public ResponseEntity<Void> config(@RequestBody Config in,Principal p){service.config(in.envelope(),in.revision(),p);return ResponseEntity.noContent().build();}
 @GetMapping("/objects") public Object list(Principal p){return service.list(p);}
 @PostMapping("/objects/{id}") public ResponseEntity<Void> create(@PathVariable UUID id,@RequestBody Create in,Principal p){service.create(id,in.manifest(),in.state(),in.chunkCount(),p);return ResponseEntity.noContent().build();}
 @PutMapping("/objects/{id}/chunks/{index}") public ResponseEntity<Void> upload(@PathVariable UUID id,@PathVariable int index,HttpServletRequest request,Principal p)throws Exception{service.chunk(id,index,request.getInputStream(),p);return ResponseEntity.noContent().build();}
 @GetMapping("/objects/{id}/chunks/{index}") public ResponseEntity<org.springframework.core.io.Resource> chunk(@PathVariable UUID id,@PathVariable int index,Principal p)throws Exception{return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.APPLICATION_OCTET_STREAM).body(service.chunk(id,index,p));}
 @PutMapping("/objects/{id}/state") public ResponseEntity<Void> state(@PathVariable UUID id,@RequestBody State in,Principal p){service.state(id,in.state(),in.revision(),p);return ResponseEntity.noContent().build();}
 @DeleteMapping("/objects/{id}") public ResponseEntity<Void> delete(@PathVariable UUID id,Principal p)throws Exception{service.delete(id,p);return ResponseEntity.noContent().build();}
 public record Config(String envelope,long revision){}
 public record Create(String manifest,String state,int chunkCount){}
 public record State(String state,long revision){}
}
