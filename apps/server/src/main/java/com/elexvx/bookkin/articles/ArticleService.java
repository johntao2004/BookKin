package com.elexvx.bookkin.articles;

import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.*;
import com.elexvx.bookkin.filemanagement.infrastructure.PrivateContentStore;
import com.elexvx.bookkin.ai.AiMetadataService;
import tools.jackson.databind.ObjectMapper;
import java.security.Principal;
import jakarta.validation.constraints.*;
import java.util.*;
import java.io.*;
import javax.imageio.ImageIO;
import org.jooq.DSLContext;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
// 协调需登录的文章读取、受控导入、图片清洗及用户阅读记录；正文清洗不依赖前端可信。
// Coordinates authenticated article reads, controlled imports, image sanitization and user reading state without trusting client sanitization.
public class ArticleService {
    static final int MAX_CAPTURE_HTML_BYTES = 8 * 1024 * 1024;
    private static final java.util.regex.Pattern INTERNAL_ASSET_URL=java.util.regex.Pattern.compile("^/api/v1/articles/assets/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$");
    private static final int MAX_COVER_BYTES = 5 * 1024 * 1024;
    private final java.util.concurrent.ConcurrentHashMap<UUID,Long> fetchTimes=new java.util.concurrent.ConcurrentHashMap<>();
    private final DSLContext db; private final UserRepository users; private final PublicWebFetcher web;
    private final PrivateContentStore files; private final AiMetadataService ai; private final ObjectMapper json;
    public ArticleService(DSLContext db, UserRepository users, PublicWebFetcher web, PrivateContentStore files, AiMetadataService ai, ObjectMapper json) {
        this.db=db;this.users=users;this.web=web;this.files=files;this.ai=ai;this.json=json;
    }
    public BookKinUser actor(Principal principal) {
        if(principal==null) throw ApiException.forbidden("AUTH_REQUIRED","请先登录。");
        return users.findByUsername(principal.getName()).orElseThrow(() -> ApiException.forbidden("AUTH_REQUIRED","请先登录。"));
    }
    private BookKinUser manager(Principal principal) {
        var user=actor(principal);if(!user.canManageFiles())throw ApiException.forbidden("MANAGER_REQUIRED","仅主人和管理员可导入或管理文章。");return user;
    }
    public List<Map<String,Object>> list(Principal principal) {
        var user=actor(principal);
        var rows=db.fetch("select a.id,a.title,a.author,a.source_url,a.published_at,a.visibility,a.tags,a.created_at,a.updated_at,a.owner_id,a.html,a.cover_asset_id from articles a where a.visibility='PUBLIC' or a.owner_id=? or ? order by a.created_at desc limit 500",user.id(),user.canManageFiles()).intoMaps();
        var cards=new ArrayList<Map<String,Object>>(rows.size());
        for(var row:rows) {
            var card=new LinkedHashMap<String,Object>(row);
            String html=(String)card.remove("html");
            UUID coverAsset=(UUID)card.remove("cover_asset_id");
            card.put("cover_url",coverAsset==null?null:assetUrl(coverAsset));
            card.put("excerpt",articleExcerpt(html));
            cards.add(card);
        }
        return cards;
    }
    private static String assetUrl(UUID id) { return "/api/v1/articles/assets/"+id; }
    private static String articleExcerpt(String html) {
        if(html==null||html.isBlank())return "";
        var document=Jsoup.parseBodyFragment(html);
        document.select("script,style,iframe,form,object,embed,svg,video,audio,template,noscript").remove();
        String text=document.body().text();
        int codePoints=text.codePointCount(0,text.length());
        return codePoints<=200?text:text.substring(0,text.offsetByCodePoints(0,200));
    }
    public Map<String,Object> get(UUID id,Principal principal) {
        var user=actor(principal);
        var row=db.fetchOne("select * from articles where id=? and (visibility='PUBLIC' or owner_id=? or ?)",id,user.id(),user.canManageFiles());
        if(row==null)throw ApiException.notFound("ARTICLE_NOT_FOUND","文章不存在或无权访问。");
        var article=new LinkedHashMap<String,Object>(row.intoMap());
        article.remove("duplicate_source_key");
        article.remove("duplicate_content_key");
        UUID coverAsset=(UUID)article.remove("cover_asset_id");
        article.put("cover_url",coverAsset==null?null:assetUrl(coverAsset));
        return article;
    }

    /** Module gateway for a readable source label; never loads article HTML or another user's notes. */
    public ArticleReference reference(UUID id, Principal principal) {
        var user = actor(principal);
        var row = db.fetchOne("select id,title from articles where id=? and (visibility='PUBLIC' or owner_id=? or ?)",
                id, user.id(), user.canManageFiles());
        if (row == null) throw ApiException.notFound("ARTICLE_NOT_FOUND", "文章不存在或无权访问。");
        return new ArticleReference(row.get("id", UUID.class), row.get("title", String.class));
    }
    public record ArticleReference(UUID id, String title) {}
    public record Draft(@NotBlank @Size(max=300) String title,@NotNull @Size(max=300) String author,@NotNull @Size(max=4096) String sourceUrl,@NotNull @Size(max=100) String publishedAt,@NotNull String visibility,@NotNull @Size(max=1000) String tags,@NotNull @Size(max=30000000) String html,@Size(max=8000000) String coverUrl) {}
    public String prepare(String html,String sourceUrl,Principal principal) {
        manager(principal);
        return clean(html,sourceUrl,principal);
    }
    public Draft fetch(String url,Principal principal) {
        var requesting=manager(principal);long now=System.currentTimeMillis();
        rejectDuplicateSource(url,null);
        fetchTimes.compute(requesting.id(),(id,previous)->{if(previous!=null&&now-previous<5000)throw new ApiException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,"FETCH_RATE","请稍等几秒再抓取。");return now;});
        var result=web.get(url,MAX_CAPTURE_HTML_BYTES);
        rejectDuplicateSource(result.url(),null);
        if(result.mime()==null || !result.mime().toLowerCase(Locale.ROOT).contains("html"))throw ApiException.badRequest("NOT_HTML","链接不是 HTML 网页。");
        var document=Jsoup.parse(new String(result.bytes(),java.nio.charset.StandardCharsets.UTF_8),result.url());
        Element body=document.selectFirst("#js_content,article,main");if(body==null)body=document.body();
        var title=document.selectFirst("#activity-name,h1");var author=document.selectFirst("#js_name,[rel=author]");
        String publishedAt=ArticlePublicationTime.extract(document,json);
        String coverUrl=captureCover(document,body,result.url(),principal);
        return new Draft(title==null?document.title():title.text(),author==null?"":author.text(),result.url(),publishedAt,"PUBLIC","",clean(body.html(),result.url(),principal),coverUrl);
    }
    private String captureCover(org.jsoup.nodes.Document document,Element body,String base,Principal principal) {
        for(var meta:document.select("meta[property=og:image],meta[property=twitter:image],meta[name=twitter:image]")) {
            var source=resolveImageUrl(base,meta.attr("content"));
            if(source==null)continue;
            try {
                var download=web.get(source.toString(),MAX_COVER_BYTES);
                UUID id=asset(download.bytes(),principal);
                var matches=new HashSet<java.net.URI>();
                matches.add(source);
                var finalUrl=resolveImageUrl(base,download.url());
                if(finalUrl!=null)matches.add(finalUrl);
                removeCapturedCoverImages(body,base,matches);
                return assetUrl(id);
            } catch(Exception failed) {
                // The social preview is optional; keep the article body available when its cover cannot be captured.
            }
        }
        return null;
    }
    private static java.net.URI resolveImageUrl(String base,String value) {
        if(value==null||value.isBlank())return null;
        try {
            var uri=java.net.URI.create(base).resolve(value.trim()).normalize();
            if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null)return null;
            return uri;
        } catch(IllegalArgumentException invalidUrl) { return null; }
    }
    private static void removeCapturedCoverImages(Element body,String base,Set<java.net.URI> coverUrls) {
        for(var image:new ArrayList<>(body.select("img"))) {
            String source=image.hasAttr("data-src")&&!image.attr("data-src").isBlank()?image.attr("data-src"):image.attr("src");
            var imageUrl=resolveImageUrl(base,source);
            if(imageUrl!=null&&coverUrls.contains(imageUrl))image.remove();
        }
    }
    public static String sanitize(String html) {
        var safe=Safelist.relaxed().addTags("section","figure","figcaption","mark").addAttributes(":all","style","id");
        var doc=Jsoup.parseBodyFragment(Jsoup.clean(html,"https://bookkin.invalid",safe.preserveRelativeLinks(true)));
        for(var node:new ArrayList<>(doc.body().childNodes()))if(node instanceof org.jsoup.nodes.TextNode text && !text.isBlank())text.wrap("<p></p>");
        int i=0;
        for(var el:doc.body().getAllElements()) {
            StringBuilder style=new StringBuilder();
            for(String rule:el.attr("style").split(";")) {
                String value=rule.trim();
                if(value.matches("(?i)(text-align\\s*:\\s*(left|right|center|justify)|font-weight\\s*:\\s*(bold|normal|[1-9]00)|font-style\\s*:\\s*(italic|normal)|text-decoration\\s*:\\s*(underline|line-through)|white-space\\s*:\\s*(pre-wrap|normal))"))style.append(value).append(';');
            }
            el.removeAttr("style");if(!style.isEmpty())el.attr("style",style.toString());
            el.removeAttr("id");
            if(Set.of("p","h1","h2","h3","h4","li","blockquote","pre","figure").contains(el.tagName()))el.attr("id","p-"+(++i));
            if(el.tagName().equals("a"))el.attr("rel","noreferrer noopener").attr("target","_blank");
        }
        return doc.body().html();
    }
    public String clean(String html,String base,Principal principal) {
        if(html==null||html.length()>30_000_000)throw ApiException.badRequest("ARTICLE_SIZE","文章正文过大或为空。");
        var doc=Jsoup.parseBodyFragment(html,base==null?"":base);
        doc.select("script,iframe,form,object,embed,video,audio").remove();
        for(var style:doc.select("style"))if(style.closest("svg")==null)style.remove();
        int count=0;
        for(var image:new ArrayList<>(doc.select("img,svg"))) {
            if(image.parents().stream().anyMatch(parent->parent.tagName().equals("svg")))continue;
            if(++count>40){image.remove();continue;}
            try {
                if(image.tagName().equals("svg")) {
                    String alt=image.attr("aria-roledescription").startsWith("flowchart")?"文章流程图":"文章插图";
                    UUID id=asset(ArticleSvgRasterizer.rasterize(image),principal);
                    image.replaceWith(new Element("img").attr("src","/api/v1/articles/assets/"+id)
                            .attr("alt",alt).attr("loading","lazy"));
                    continue;
                }
                String src=image.hasAttr("data-src")?image.attr("data-src"):image.attr("src");
                String alt=image.attr("alt");
                if(src.matches("/api/v1/articles/assets/[0-9a-f-]{36}")) {
                    UUID id=UUID.fromString(src.substring(src.lastIndexOf('/')+1));
                    this.image(id,principal);
                } else {
                    byte[] bytes;
                    if(src.startsWith("data:image/")&&src.contains(";base64,")) {
                        if(src.length()>8_000_000)throw new IOException();
                        bytes=Base64.getDecoder().decode(src.substring(src.indexOf(',')+1));
                    } else { bytes=web.get(java.net.URI.create(base==null?"":base).resolve(src).toString(),MAX_COVER_BYTES).bytes(); }
                    src="/api/v1/articles/assets/"+asset(bytes,principal);
                }
                image.clearAttributes();image.attr("src",src).attr("loading","lazy");
                if(!alt.isBlank())image.attr("alt",alt);
            } catch(Exception failed){image.replaceWith(new Element("p").text("[图片未能导入]"));}
        }
        return sanitize(doc.body().html());
    }
    public UUID asset(byte[] bytes,Principal principal) throws IOException {
        var user=manager(principal);if(bytes.length>5*1024*1024)throw new IOException("Image too large");
        // 先限制尺寸再解码；保存规范化的无主动内容位图。
        // Decode only after dimensions have been bounded; persist a normalized raster without active content.
        try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw new IOException("Unsupported image");
            var reader=readers.next();try {
                reader.setInput(stream);int w=reader.getWidth(0),h=reader.getHeight(0);
                if(w<=0||h<=0||(long)w*h>20_000_000)throw new IOException("Too many pixels");
                var out=new ByteArrayOutputStream();ImageIO.write(reader.read(0),"png",out);UUID id=UUID.randomUUID();
                files.create("articles",user.id(),id,new ByteArrayInputStream(out.toByteArray()),25*1024*1024);
                db.execute("insert into article_assets(id,owner_id,mime) values (?,?,'image/png')",id,user.id());return id;
            }finally{reader.dispose();}
        }
    }
    public org.springframework.core.io.Resource image(UUID id,Principal principal)throws IOException {
        var user=actor(principal);
        var row=db.fetchOne("select owner_id from article_assets where id=? and (owner_id=? or exists(select 1 from article_asset_links l join articles a on a.id=l.article_id where l.asset_id=? and (a.visibility='PUBLIC' or a.owner_id=? or ?)))",id,user.id(),id,user.id(),user.canManageFiles());
        if(row==null)throw ApiException.notFound("ASSET_NOT_FOUND","图片不存在。");return files.resource("articles",row.get("owner_id",UUID.class),id);
    }
    @Transactional public Map<String,Object> save(UUID id,Draft input,Principal principal) {
        var user=manager(principal);if(id==null)id=UUID.randomUUID();else get(id,principal);
        if(input.title()==null||input.title().isBlank()||input.title().length()>300)throw ApiException.badRequest("TITLE_REQUIRED","请输入不超过 300 字的标题。");
        if(!Set.of("PUBLIC","PRIVATE").contains(input.visibility()))throw ApiException.badRequest("VISIBILITY","可见范围无效。");
        rejectDuplicateSource(input.sourceUrl(),id);
        String html=clean(input.html(),input.sourceUrl(),principal);
        String sourceKey=ArticleIdentity.sourceKey(input.sourceUrl());
        String contentKey=articleContentKey(html,principal);
        // Serialize check + write across API instances, including concurrent create/update requests.
        db.execute("lock table articles in share row exclusive mode");
        for(var legacy:db.fetch("select id,source_url,html from articles where duplicate_source_key is null or duplicate_content_key is null")) {
            db.execute("update articles set duplicate_source_key=?,duplicate_content_key=? where id=?",
                    ArticleIdentity.sourceKey(legacy.get("source_url",String.class)),articleContentKey(legacy.get("html",String.class),principal),legacy.get("id",UUID.class));
        }
        if(!sourceKey.isEmpty()&&db.fetchExists(db.selectOne().from("articles").where("id<>? and duplicate_source_key=?",id,sourceKey)))
            throw duplicateArticle("已有相同来源链接的文章，请在文章列表中查看或编辑。");
        if(!contentKey.isEmpty()&&db.fetchExists(db.selectOne().from("articles").where("id<>? and duplicate_content_key=?",id,contentKey)))
            throw duplicateArticle("已有相同正文的文章，无需重复导入。");
        UUID coverAsset=normalizeCover(input.coverUrl(),principal);
        db.execute("insert into articles(id,owner_id,title,author,source_url,published_at,visibility,tags,html,cover_asset_id) values (?,?,?,?,?,?,?,?,?,?) on conflict(id) do update set title=excluded.title,author=excluded.author,source_url=excluded.source_url,published_at=excluded.published_at,visibility=excluded.visibility,tags=excluded.tags,html=excluded.html,cover_asset_id=excluded.cover_asset_id,knowledge='[]',knowledge_revision=null,updated_at=now()",id,user.id(),input.title(),input.author(),input.sourceUrl(),input.publishedAt(),input.visibility(),input.tags(),html,coverAsset);
        db.execute("update articles set duplicate_source_key=?,duplicate_content_key=? where id=?",sourceKey,contentKey,id);
        db.execute("delete from article_asset_links where article_id=?",id);
        for(var image:Jsoup.parseBodyFragment(html).select("img")) {
            var match=INTERNAL_ASSET_URL.matcher(image.attr("src"));
            if(match.matches())db.execute("insert into article_asset_links values (?,?) on conflict do nothing",id,UUID.fromString(match.group(1)));
        }
        if(coverAsset!=null)db.execute("insert into article_asset_links values (?,?) on conflict do nothing",id,coverAsset);
        return get(id,principal);
    }
    private static ApiException duplicateArticle(String message) {
        return ApiException.conflict("ARTICLE_DUPLICATE",message);
    }
    private void rejectDuplicateSource(String source,UUID excluded) {
        String key=ArticleIdentity.sourceKey(source);
        if(key.isEmpty())return;
        // Legacy URLs are checked before capture too, without downloading the webpage or its assets.
        for(var row:db.fetch("select id,source_url from articles where duplicate_source_key=? or duplicate_source_key is null",key)) {
            if(!Objects.equals(excluded,row.get("id",UUID.class))&&key.equals(ArticleIdentity.sourceKey(row.get("source_url",String.class))))
                throw duplicateArticle("已有相同来源链接的文章，请在文章列表中查看或编辑。");
        }
    }
    private String articleContentKey(String html,Principal principal) {
        return ArticleIdentity.contentKey(html,source->{
            var match=INTERNAL_ASSET_URL.matcher(source);
            if(match.matches())try {
                var resource=image(UUID.fromString(match.group(1)),principal);
                if(resource!=null)try(var stream=resource.getInputStream()) {
                    var digest=java.security.MessageDigest.getInstance("SHA-256");
                    try(var hashed=new java.security.DigestInputStream(stream,digest)) { hashed.transferTo(OutputStream.nullOutputStream()); }
                    return HexFormat.of().formatHex(digest.digest());
                }
            } catch(java.security.NoSuchAlgorithmException impossible) {
                throw new IllegalStateException(impossible);
            } catch(IOException|ApiException unavailable) {
                // Preserve imports with a missing legacy image; its stored reference remains distinct.
            }
            return source;
        });
    }
    private UUID normalizeCover(String coverUrl,Principal principal) {
        if(coverUrl==null||coverUrl.isBlank())return null;
        var internal=INTERNAL_ASSET_URL.matcher(coverUrl);
        if(internal.matches()) {
            UUID id=UUID.fromString(internal.group(1));
            try { image(id,principal); }
            catch(IOException inaccessible) { throw ApiException.notFound("ASSET_NOT_FOUND","封面图片不存在或无权访问。"); }
            return id;
        }
        if(!coverUrl.startsWith("data:image/")||!coverUrl.contains(";base64,"))
            throw ApiException.badRequest("COVER_INVALID","封面必须是图片或已授权的文章图片资源。");
        if(coverUrl.length()>8_000_000)throw ApiException.badRequest("COVER_INVALID","封面图片过大或格式无效。");
        String mediaType=coverUrl.substring("data:".length(),coverUrl.indexOf(';'));
        if(!mediaType.matches("(?i)image/(?:jpeg|png|webp)"))throw ApiException.badRequest("COVER_INVALID","请选择 JPEG、PNG 或 WebP 封面。");
        try {
            byte[] bytes=Base64.getDecoder().decode(coverUrl.substring(coverUrl.indexOf(',')+1));
            return asset(bytes,principal);
        } catch(IllegalArgumentException|IOException invalidImage) {
            throw ApiException.badRequest("COVER_INVALID","封面图片无法读取或格式不受支持。");
        }
    }
    @Transactional public void delete(UUID id,Principal p){manager(p);get(id,p);db.execute("delete from articles where id=?",id);}
    public Map<String,Object> reading(UUID id,Principal p) {
        get(id,p);var row=db.fetchOne("select state::text,revision from article_reading where article_id=? and user_id=?",id,actor(p).id());
        return row==null?Map.of("state","{}","revision",0):row.intoMap();
    }
    @Transactional public void reading(UUID id,String state,long revision,Principal p) {
        get(id,p);if(state==null||state.length()>1_000_000)throw ApiException.badRequest("STATE_SIZE","阅读记录过大。");
        // Like ordinary book positions, the last submitted state wins for this user.
        // Keep revision as a server counter and accept older clients' revision fields.
        db.execute("insert into article_reading(article_id,user_id,state,revision) values (?,?,?::jsonb,1) on conflict(article_id,user_id) do update set state=excluded.state,revision=article_reading.revision+1",id,actor(p).id(),state);
    }
    public List<Map<String,Object>> knowledge(Principal p) {
        var user=actor(p);return db.fetch("select id,title,knowledge::text as points from articles where visibility='PUBLIC' or owner_id=? or ?",user.id(),user.canManageFiles()).intoMaps();
    }
    public void generate(UUID id,Principal p) throws Exception {
        manager(p);var article=get(id,p);UUID operation=UUID.randomUUID();
        db.execute("update articles set knowledge_revision=? where id=?",operation,id);
        var passages=Jsoup.parseBodyFragment((String)article.get("html")).select("[id]").stream().filter(el->!el.text().isBlank()).limit(80)
            .map(el->new AiMetadataService.KnowledgePassage(el.id(),el.text().substring(0,Math.min(2000,el.text().length())))).toList();
        var result=ai.extractKnowledge(passages);
        if(db.execute("update articles set knowledge=?::jsonb where id=? and knowledge_revision=?",json.writeValueAsString(result.points()),id,operation)==0)
            throw ApiException.conflict("SOURCE_CHANGED","文章已变化，请重新分析。");
    }
}
