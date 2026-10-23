package com.elexvx.bookkin.annotations;

import com.elexvx.bookkin.articles.ArticleService;
import com.elexvx.bookkin.catalog.BookRepository;
import com.elexvx.bookkin.catalog.BookReviewRepository.BookReview;
import com.elexvx.bookkin.catalog.BookReviewService;
import com.elexvx.bookkin.catalog.ReviewVisibility;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReadingPostsService {
    public enum Kind { BOOK, ARTICLE, ALL }
    private final ArticlePostRepository articles;
    private final BookReviewService books;
    private final BookRepository catalog;
    private final ArticleService articleAccess;
    private final UserRepository users;

    public ReadingPostsService(ArticlePostRepository articles, BookReviewService books, BookRepository catalog,
                               ArticleService articleAccess, UserRepository users) {
        this.articles=articles; this.books=books; this.catalog=catalog; this.articleAccess=articleAccess; this.users=users;
    }

    @Transactional(readOnly=true)
    public Page mine(Kind kind, String cursor, Principal principal) {
        var user=actor(principal);
        Cursor before=decode(cursor);
        var items=new ArrayList<Post>();
        if (kind != Kind.ARTICLE) books.mine(principal,before.time(),before.id(),31).forEach(row -> items.add(book(row)));
        if (kind != Kind.BOOK) articles.mine(user.id(),before.time(),before.id(),31).forEach(row -> items.add(article(row)));
        var sorted=items.stream().sorted(Comparator.comparing((Post post) -> post.createdAt().toInstant()).reversed()
                .thenComparing(post -> post.id().toString(),Comparator.reverseOrder())).toList();
        var titles=new HashMap<String,String>();
        var selected=sorted.stream().limit(30).map(post -> {
            var key=post.kind()+":"+post.sourceId();
            var title=titles.computeIfAbsent(key, ignored -> ownedSourceTitle(post.kind(),post.sourceId(),principal));
            return decorate(post,title,false);
        }).toList();
        String next=sorted.size()>30 ? encode(selected.getLast()) : null;
        return new Page(selected,next);
    }

    @Transactional(readOnly=true)
    public Post get(Kind kind, UUID id, Principal principal) {
        var user=actor(principal);
        Post post;
        if (kind==Kind.BOOK) post=book(books.get(id,principal));
        else if (kind==Kind.ARTICLE) post=article(articles.visible(id,user.id()).orElseThrow(this::missing));
        else throw ApiException.badRequest("POST_KIND_INVALID","请选择书籍或文章。");
        return decorate(post,post.userId().equals(user.id()) ? ownedSourceTitle(kind,post.sourceId(),principal)
                : sourceTitle(kind,post.sourceId(),principal),true);
    }

    @Transactional
    public Post create(Kind kind, UUID sourceId, String title, String markdown, ReviewVisibility visibility, Principal principal) {
        var user=actor(principal);
        validate(title,markdown);
        String sourceTitle=sourceTitle(kind,sourceId,principal);
        var selected=visibility==null ? ReviewVisibility.PRIVATE : visibility;
        Post saved=kind==Kind.BOOK ? book(books.create(sourceId,title.trim(),markdown,selected,principal))
                : article(articles.create(sourceId,user.id(),user.displayName(),title.trim(),markdown,selected));
        return decorate(saved,sourceTitle,true);
    }

    @Transactional
    public Post update(Kind kind, UUID id, String title, String markdown, ReviewVisibility visibility, long revision, Principal principal) {
        var user=actor(principal);
        validate(title,markdown);
        if (kind==Kind.BOOK) {
            var existing=books.get(id,principal);
            var label=sourceTitle(kind,existing.bookId(),principal);
            return decorate(book(books.update(id,title.trim(),markdown,visibility,revision,principal)),label,true);
        }
        if (kind!=Kind.ARTICLE) throw ApiException.badRequest("POST_KIND_INVALID","请选择书籍或文章。");
        var existing=articles.visible(id,user.id()).filter(post -> post.userId().equals(user.id())).orElseThrow(this::missing);
        String label=ownedSourceTitle(kind,existing.sourceId(),principal);
        var saved=articles.update(id,user.id(),revision,title.trim(),markdown,visibility==null ? ReviewVisibility.PRIVATE : visibility)
                .orElseThrow(() -> ApiException.conflict("REVISION_CONFLICT","随笔已在其他页面更新，请刷新后重试。"));
        return decorate(article(saved),label,true);
    }

    private String sourceTitle(Kind kind, UUID id, Principal principal) {
        if (kind==Kind.BOOK) return catalog.reference(id).orElseThrow(() -> ApiException.notFound("BOOK_NOT_FOUND","未找到这本书。")).title();
        if (kind==Kind.ARTICLE) return articleAccess.reference(id,principal).title();
        throw ApiException.badRequest("POST_KIND_INVALID","请选择书籍或文章。");
    }
    private String ownedSourceTitle(Kind kind, UUID id, Principal principal) {
        try { return sourceTitle(kind,id,principal); }
        catch (ApiException unavailable) {
            if (unavailable.status().value()!=404) throw unavailable;
            return "原文不可用";
        }
    }
    private com.elexvx.bookkin.users.BookKinUser actor(Principal principal) {
        if (principal==null) throw ApiException.forbidden("AUTH_REQUIRED","请先登录。");
        return users.findByUsername(principal.getName()).orElseThrow(() -> ApiException.forbidden("AUTH_REQUIRED","请先登录。"));
    }
    private void validate(String title, String markdown) {
        if (title==null || title.isBlank() || title.length()>200) throw ApiException.badRequest("POST_TITLE_INVALID","请填写不超过 200 字的标题。");
        if (markdown==null || markdown.isBlank() || markdown.length()>500_000) throw ApiException.badRequest("POST_BODY_INVALID","请填写不超过 500000 字的正文。");
    }
    private ApiException missing() { return ApiException.notFound("POST_NOT_FOUND","随笔不存在或无权访问。"); }
    private Post book(BookReview row) { return new Post(row.id(),Kind.BOOK,row.bookId(),null,row.userId(),row.authorName(),row.title(),row.markdown(),null,row.visibility(),row.revision(),row.createdAt(),row.updatedAt()); }
    private Post article(ArticlePostRepository.ArticlePost row) { return new Post(row.id(),Kind.ARTICLE,row.sourceId(),null,row.userId(),row.authorName(),row.title(),row.markdown(),null,row.visibility(),row.revision(),row.createdAt(),row.updatedAt()); }
    private Post decorate(Post post,String sourceTitle,boolean body) { return new Post(post.id(),post.kind(),post.sourceId(),sourceTitle,post.userId(),post.authorName(),post.title(),body?post.markdown():null,post.markdown().substring(0,Math.min(240,post.markdown().length())),post.visibility(),post.revision(),post.createdAt(),post.updatedAt()); }
    private String encode(Post post) { return Base64.getUrlEncoder().withoutPadding().encodeToString((post.createdAt()+"|"+post.id()).getBytes(StandardCharsets.UTF_8)); }
    private Cursor decode(String value) {
        if (value==null || value.isBlank()) return new Cursor(null,null);
        try {
            if(value.length()>200) throw new IllegalArgumentException();
            var parts=new String(Base64.getUrlDecoder().decode(value),StandardCharsets.UTF_8).split("\\|",-1);
            if(parts.length!=2) throw new IllegalArgumentException();
            return new Cursor(OffsetDateTime.parse(parts[0]),UUID.fromString(parts[1]));
        } catch (RuntimeException invalid) { throw ApiException.badRequest("CURSOR_INVALID","分页位置无效。"); }
    }
    private record Cursor(OffsetDateTime time,UUID id) {}
    public record Page(List<Post> items,String nextCursor) {}
    public record Post(UUID id,Kind kind,UUID sourceId,String sourceTitle,UUID userId,String authorName,String title,
                       String markdown,String excerpt,ReviewVisibility visibility,long revision,OffsetDateTime createdAt,OffsetDateTime updatedAt) {}
}
