// 验证 SMTP 传输与重置链接来源的安全约束，明确区分允许的本机测试与远程不加密连接。
// Checks SMTP transport and reset-origin constraints, distinguishing explicit loopback testing from unencrypted remote connections.
package com.elexvx.bookkin.auth;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class MailServiceTest {
    private MailService.Settings settings(String host,String security,String url) {
        return new MailService.Settings(true,host,587,security,"","secret","library@example.com",url,true);
    }
    @Test void rejectsUnencryptedRemoteSmtp() {
        assertThrows(RuntimeException.class,()->MailService.validate(settings("smtp.example.com","LOCAL","https://books.example.com")));
    }
    @Test void rejectsUnsafeResetOrigins() {
        for(String url:new String[]{"http://books.example.com","https://a.example@evil.example","https://books.example.com/#evil","https://books.example.com/path","file:///etc/passwd"})
            assertThrows(RuntimeException.class,()->MailService.validate(settings("smtp.example.com","TLS",url)));
    }
    @Test void acceptsTlsAndExplicitLoopbackTesting() {
        assertDoesNotThrow(()->MailService.validate(settings("smtp.example.com","STARTTLS","https://books.example.com")));
        assertDoesNotThrow(()->MailService.validate(settings("127.0.0.1","LOCAL","http://127.0.0.1:4173")));
    }
    @Test void rejectsMalformedTokens() {
        for(String token:new String[]{"", "123", "a".repeat(1000)}) assertThrows(RuntimeException.class,()->RecoveryService.hash(token));
        assertEquals(64,RecoveryService.hash("a".repeat(43)).length());
    }
}
