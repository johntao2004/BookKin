package com.elexvx.bookkin.users;

import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.common.ApiException;
import jakarta.validation.constraints.*;
import java.net.URI;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
public class SiteSettingsService {
    private final DSLContext db;
    private final ObjectMapper json;
    private final UserRepository users;
    private final AuditService audit;
    public SiteSettingsService(DSLContext db, ObjectMapper json, UserRepository users, AuditService audit) {
        this.db=db; this.json=json; this.users=users; this.audit=audit;
    }
    public record Settings(@NotBlank @Size(max=80) String name, @NotNull @Size(max=120) String tagline,
        @NotNull @Size(max=500) String description, @NotNull @Size(max=250) String keywords,
        @NotNull @Size(max=255) String publicUrl, @NotNull Boolean allowIndexing,
        @NotNull @Size(max=80) String icpNumber, @NotNull @Size(max=80) String policeNumber,
        @NotNull @Size(max=200) String copyright, @NotNull @Email @Size(max=254) String contactEmail) {}
    public Settings current() {
        return json.readValue(db.fetchOne("select settings::text from site_settings where id=1").get(0,String.class),Settings.class);
    }
    static Settings normalize(Settings s) {
        var url=s.publicUrl().trim();
        if(!url.isEmpty()) {
            try {
                var uri=URI.create(url);
                if(!("https".equalsIgnoreCase(uri.getScheme())||"http".equalsIgnoreCase(uri.getScheme()))
                    ||uri.getHost()==null||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null
                    ||!(uri.getPath().isEmpty()||"/".equals(uri.getPath()))) throw new IllegalArgumentException();
                url=uri.toString().replaceAll("/$","");
            } catch(IllegalArgumentException e) {throw ApiException.badRequest("INVALID_SITE_URL","站点地址需为完整的 HTTP/HTTPS 域名地址，不含路径、账号、查询参数或片段。");}
        }
        return new Settings(s.name().trim(),s.tagline().trim(),s.description().trim(),s.keywords().trim(),url,
            s.allowIndexing(),s.icpNumber().trim(),s.policeNumber().trim(),s.copyright().trim(),s.contactEmail().trim());
    }
    @Transactional
    public Settings save(String username, Settings settings) {
        var actor=users.findByUsername(username).orElseThrow();
        if(actor.role()!=UserRole.OWNER) throw ApiException.forbidden("OWNER_REQUIRED","仅主人可修改个性化设置。");
        var clean=normalize(settings);
        db.execute("update site_settings set settings=?::jsonb,updated_at=now() where id=1",json.writeValueAsString(clean));
        audit.record(actor.id(),"SITE_SETTINGS_CHANGED","SITE","site-settings",null,null,null,null,"SUCCEEDED","{}");
        return clean;
    }
    public String robots() {
        if(!current().allowIndexing()) return "User-agent: *\nDisallow: /\n";
        return "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /settings\nDisallow: /admin/\nDisallow: /reader/\nDisallow: /vault\nDisallow: /annotations\nDisallow: /profile\nDisallow: /login\nDisallow: /setup\n";
    }
}
