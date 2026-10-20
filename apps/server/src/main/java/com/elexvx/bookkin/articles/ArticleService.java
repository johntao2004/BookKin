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
public class ArticleService {
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
        var user=principal==null?null:actor(principal);
        return db.fetch("select id,title,author,source_url,published_at,visibility,tags,created_at,updated_at,owner_id from articles where visibility='PUBLIC' or owner_id=? or ? order by created_at desc limit 500",user==null?null:user.id(),user!=null&&user.canManageFiles()).intoMaps();
    }
    public Map<String,Object> get(UUID id,Principal principal) {
        var user=principal==null?null:actor(principal);
        var row=db.fetchOne("select * from articles where id=? and (visibility='PUBLIC' or owner_id=? or ?)",id,user==null?null:user.id(),user!=null&&user.canManageFiles());
        if(row==null)throw ApiException.notFound("ARTICLE_NOT_FOUND","文章不存在或无权访问。");
        return row.intoMap();
    }
    public record Draft(@NotBlank @Size(max=300) String title,@NotNull @Size(max=300) String author,@NotNull @Size(max=4096) String sourceUrl,@NotNull @Size(max=100) String publishedAt,@NotNull String visibility,@NotNull @Size(max=1000) String tags,@NotNull @Size(max=30000000) String html) {}
    public Draft fetch(String url,Principal principal) {
        var requesting=manager(principal);long now=System.currentTimeMillis();
        fetchTimes.compute(requesting.id(),(id,previous)->{if(previous!=null&&now-previous<5000)throw new ApiException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,"FETCH_RATE","请稍等几秒再抓取。");return now;});
        var result=web.get(url,3*1024*1024);
        if(result.mime()==null || !result.mime().toLowerCase(Locale.ROOT).contains("html"))throw ApiException.badRequest("NOT_HTML","链接不是 HTML 网页。");
        var document=Jsoup.parse(new String(result.bytes(),java.nio.charset.StandardCharsets.UTF_8),result.url());
        Element body=document.selectFirst("#js_content,article,main");if(body==null)body=document.body();
        var title=document.selectFirst("#activity-name,h1");var author=document.selectFirst("#js_name,[rel=author]");
        return new Draft(title==null?document.title():title.text(),author==null?"":author.text(),result.url(),"","PUBLIC","",clean(body.html(),result.url(),principal));
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
        doc.select("script,style,iframe,form,object,embed,svg,video,audio").remove();int count=0;
        for(var image:doc.select("img")) {
            if(++count>40){image.remove();continue;}
            String src=image.hasAttr("data-src")?image.attr("data-src"):image.attr("src");
            try {
                if(src.matches("/api/v1/articles/assets/[0-9a-f-]{36}")) {
                    UUID id=UUID.fromString(src.substring(src.lastIndexOf('/')+1));
                    this.image(id,principal);
                } else {
                    byte[] bytes;
                    if(src.startsWith("data:image/")&&src.contains(";base64,")) {
                        if(src.length()>8_000_000)throw new IOException();
                        bytes=Base64.getDecoder().decode(src.substring(src.indexOf(',')+1));
                    } else { bytes=web.get(java.net.URI.create(base==null?"":base).resolve(src).toString(),5*1024*1024).bytes(); }
                    src="/api/v1/articles/assets/"+asset(bytes,principal);
                }
                image.clearAttributes();image.attr("src",src).attr("loading","lazy");
            } catch(Exception failed){image.replaceWith(new Element("p").text("[图片未能导入]"));}
        }
        return sanitize(doc.body().html());
    }
    public UUID asset(byte[] bytes,Principal principal) throws IOException {
        var user=manager(principal);if(bytes.length>5*1024*1024)throw new IOException("Image too large");
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
        var user=principal==null?null:actor(principal);
        var row=db.fetchOne("select owner_id from article_assets where id=? and (owner_id=? or exists(select 1 from article_asset_links l join articles a on a.id=l.article_id where l.asset_id=? and (a.visibility='PUBLIC' or a.owner_id=? or ?)))",id,user.id(),id,user==null?null:user.id(),user!=null&&user.canManageFiles());
        if(row==null)throw ApiException.notFound("ASSET_NOT_FOUND","图片不存在。");return files.resource("articles",row.get("owner_id",UUID.class),id);
    }
    @Transactional public Map<String,Object> save(UUID id,Draft input,Principal principal) {
        var user=manager(principal);if(id==null)id=UUID.randomUUID();else get(id,principal);
        if(input.title()==null||input.title().isBlank()||input.title().length()>300)throw ApiException.badRequest("TITLE_REQUIRED","请输入不超过 300 字的标题。");
        if(!Set.of("PUBLIC","PRIVATE").contains(input.visibility()))throw ApiException.badRequest("VISIBILITY","可见范围无效。");
        String html=clean(input.html(),input.sourceUrl(),principal);
        db.execute("insert into articles(id,owner_id,title,author,source_url,published_at,visibility,tags,html) values (?,?,?,?,?,?,?,?,?) on conflict(id) do update set title=excluded.title,author=excluded.author,source_url=excluded.source_url,published_at=excluded.published_at,visibility=excluded.visibility,tags=excluded.tags,html=excluded.html,knowledge='[]',knowledge_revision=null,updated_at=now()",id,user.id(),input.title(),input.author(),input.sourceUrl(),input.publishedAt(),input.visibility(),input.tags(),html);
        db.execute("delete from article_asset_links where article_id=?",id);
        for(var image:Jsoup.parseBodyFragment(html).select("img")) {
            UUID asset=UUID.fromString(image.attr("src").substring(image.attr("src").lastIndexOf('/')+1));
            db.execute("insert into article_asset_links values (?,?) on conflict do nothing",id,asset);
        }
        return get(id,principal);
    }
    @Transactional public void delete(UUID id,Principal p){manager(p);get(id,p);db.execute("delete from articles where id=?",id);}
    public Map<String,Object> reading(UUID id,Principal p) {
        get(id,p);var row=db.fetchOne("select state::text,revision from article_reading where article_id=? and user_id=?",id,actor(p).id());
        return row==null?Map.of("state","{}","revision",0):row.intoMap();
    }
    @Transactional public void reading(UUID id,String state,long revision,Principal p) {
        get(id,p);if(state==null||state.length()>1_000_000)throw ApiException.badRequest("STATE_SIZE","阅读记录过大。");
        int updated=db.execute("insert into article_reading values (?,?,?::jsonb,1) on conflict(article_id,user_id) do update set state=excluded.state,revision=article_reading.revision+1 where article_reading.revision=?",id,actor(p).id(),state,revision);
        if(updated==0)throw ApiException.conflict("REVISION_CONFLICT","另一页面已更新阅读记录，请刷新后重试。");
    }
    public List<Map<String,Object>> knowledge(Principal p) {
        var user=p==null?null:actor(p);return db.fetch("select id,title,knowledge::text as points from articles where visibility='PUBLIC' or owner_id=? or ?",user==null?null:user.id(),user!=null&&user.canManageFiles()).intoMaps();
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
