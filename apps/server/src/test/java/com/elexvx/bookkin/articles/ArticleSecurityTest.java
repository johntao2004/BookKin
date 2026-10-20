// 覆盖正文净化与地址拒绝边界，确保活动内容和私有网络目标不会通过文章导入入口。
// Covers content sanitization and address rejection so active content and private-network targets are rejected by article import.
package com.elexvx.bookkin.articles;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
import java.net.*;

class ArticleSecurityTest {
 @Test void stripsActiveContentAndPreservesStableParagraphsAndInternalImages(){
  String html=ArticleService.sanitize("<script>alert(1)</script><p onclick='x()' style='text-align:center;background:url(https://evil.test/a)'>知识沉淀</p><img src='/api/v1/articles/assets/00000000-0000-4000-8000-000000000001'><a href='javascript:alert(1)'>链接</a>");
  assertFalse(html.contains("onclick"));assertFalse(html.contains("script"));assertFalse(html.contains("background"));
  assertTrue(html.contains("text-align:center"));assertTrue(html.contains("id=\"p-1\""));assertTrue(html.contains("/api/v1/articles/assets/"));
 }
 @Test void blocksLocalPrivateBenchmarkAndMappedAddresses()throws Exception{
  for(String value:new String[]{"127.0.0.1","10.0.0.1","192.168.1.1","169.254.169.254","100.64.0.1","198.18.0.1","0.0.0.0","::1","fc00::1","::ffff:127.0.0.1"}){
   var address=InetAddress.getByName(value);assertThrows(UnknownHostException.class,()->PublicWebFetcher.validateAddress(address),value);
  }
  PublicWebFetcher.validateAddress(InetAddress.getByName("1.1.1.1"));
 }
 @Test void rejectsHttpBeforeOpeningConnection(){assertThrows(com.elexvx.bookkin.common.ApiException.class,()->new PublicWebFetcher().get("http://127.0.0.1/",100));}
}
