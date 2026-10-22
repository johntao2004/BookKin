package com.elexvx.bookkin.vault;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.UserRepository;
import com.elexvx.bookkin.filemanagement.infrastructure.PrivateContentStore;
import java.security.*;
import java.util.*;
import java.io.*;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 服务端按认证用户隔离密文与分块；信封和状态作为客户端生成数据存储。
// The server isolates ciphertext/chunks by authenticated user; envelopes and state are stored as client-generated data.
@Service
public class VaultService {
 private final DSLContext db;private final UserRepository users;private final PrivateContentStore files;
 public VaultService(DSLContext db,UserRepository users,PrivateContentStore files){this.db=db;this.users=users;this.files=files;}
 private UUID user(Principal p){if(p==null)throw ApiException.forbidden("AUTH_REQUIRED","请先登录。");return users.findByUsername(p.getName()).orElseThrow().id();}
 public Object config(Principal p){var r=db.fetchOne("select envelope::text,revision from personal_vault where user_id=?",user(p));return r==null?Map.of("envelope","","revision",0):r.intoMap();}
 @Transactional public void config(String envelope,long revision,Principal p){
  if(envelope==null||envelope.length()>16384)throw ApiException.badRequest("ENVELOPE_SIZE","密钥信封格式无效。");
  int n=revision==0?db.execute("insert into personal_vault(user_id,envelope) values (?,?::jsonb) on conflict do nothing",user(p),envelope)
   :db.execute("update personal_vault set envelope=?::jsonb,revision=revision+1 where user_id=? and revision=? and access_key_ciphertext is null",envelope,user(p),revision);
  if(n!=1)throw ApiException.conflict("REVISION_CONFLICT","专区设置已更新，请刷新。");
 }
 public List<Map<String,Object>> list(Principal p){return db.fetch("select id,manifest,state,revision,chunk_count from vault_objects where user_id=? order by created_at desc",user(p)).intoMaps();}
 public Map<String,Object> get(UUID id,Principal p){var r=db.fetchOne("select * from vault_objects where user_id=? and id=?",user(p),id);if(r==null)throw ApiException.notFound("VAULT_NOT_FOUND","未找到密文。");return r.intoMap();}
 @Transactional public void create(UUID id,String manifest,String state,int count,Principal p){
  if(count<1||count>256||manifest==null||manifest.length()>32768||state==null||state.length()>2_000_000)throw ApiException.badRequest("VAULT_INPUT","密文格式或大小无效。");
  var owner=user(p);db.fetchOne("select user_id from personal_vault where user_id=? for update",owner);
  var quota=db.fetchOne("select coalesce(sum(chunk_count),0) as total,count(*) as objects from vault_objects where user_id=?",owner);
  if(quota!=null&&(quota.get("total",Long.class)+count>2048||quota.get("objects",Long.class)>=1000))throw ApiException.badRequest("VAULT_QUOTA","个人专区最多保存 2 GiB 密文或 1000 个文件。");
  db.execute("insert into vault_objects(id,user_id,manifest,state,chunk_count) values (?,?,?,?,?)",id,user(p),manifest,state,count);
 }
 @Transactional public void chunk(UUID id,int index,InputStream input,Principal p)throws Exception{
  var object=get(id,p);if(index<0||index>=(Integer)object.get("chunk_count"))throw ApiException.badRequest("CHUNK_INDEX","分块序号无效。");
  byte[] bytes=input.readNBytes(1024*1024+29);if(bytes.length<16||bytes.length>1024*1024+28)throw ApiException.badRequest("CHUNK_SIZE","密文分块过大或无效。");
  String digest=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
  var previous=db.fetchOne("select digest from vault_chunks where user_id=? and object_id=? and chunk_index=?",user(p),id,index);
  if(previous!=null){if(!digest.equals(previous.get("digest")))throw ApiException.conflict("CHUNK_EXISTS","禁止覆盖已有密文分块。");return;}
  UUID storage=UUID.randomUUID();files.create("vault",user(p),storage,new ByteArrayInputStream(bytes),1024*1024+28);
  db.execute("insert into vault_chunks values (?,?,?,?,?)",user(p),id,index,storage,digest);
 }
 public org.springframework.core.io.Resource chunk(UUID id,int index,Principal p)throws Exception{
  get(id,p);var r=db.fetchOne("select storage_id from vault_chunks where user_id=? and object_id=? and chunk_index=?",user(p),id,index);
  if(r==null)throw ApiException.notFound("CHUNK_MISSING","分块尚未上传，请重新导入。");return files.resource("vault",user(p),r.get("storage_id",UUID.class));
 }
 // 阅读状态与普通书籍、文章一致，最后提交生效；密钥信封仍独立执行版本校验。
 // Reading state is last-write-wins; the independent key-envelope revision guard stays intact.
 @Transactional public void state(UUID id,String state,long revision,Principal p){
  if(state==null||state.length()>2_000_000)throw ApiException.badRequest("STATE_SIZE","加密记录过大。");
  if(db.execute("update vault_objects set state=?,revision=revision+1 where user_id=? and id=?",state,user(p),id)!=1)
   throw ApiException.notFound("VAULT_NOT_FOUND","未找到密文。");
 }
 @Transactional public void delete(UUID id,Principal p)throws Exception{
  get(id,p);var rows=db.fetch("select storage_id from vault_chunks where user_id=? and object_id=?",user(p),id);
  db.execute("delete from vault_objects where user_id=? and id=?",user(p),id);
  // 此处意图是清除失去引用的密文；文件与数据库不共用事务，清理失败仍需关注，不能据下方描述推断无风险。
  // 清理风险说明 / Cleanup caveat: filesystem deletion and database writes are not one transaction; failed cleanup still needs attention despite the older claim below.
  // Orphan ciphertext after a failed filesystem cleanup is harmless and remains inaccessible.
  for(var row:rows)files.delete("vault",user(p),row.get("storage_id",UUID.class));
 }
}
