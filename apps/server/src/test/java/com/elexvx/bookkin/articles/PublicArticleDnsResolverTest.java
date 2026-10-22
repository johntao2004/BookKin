package com.elexvx.bookkin.articles;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class PublicArticleDnsResolverTest {
    private static InetAddress ip(String value) throws UnknownHostException { return InetAddress.getByName(value); }

    @Test void normalPublicAnswersDoNotUseIndependentDns() throws Exception {
        var resolver = new PublicArticleDnsResolver(host -> new InetAddress[]{ip("203.205.239.154")},
                host -> { fail("No fallback for valid public DNS"); return null; });
        assertEquals("203.205.239.154", resolver.resolve("mp.weixin.qq.com")[0].getHostAddress());
    }

    @Test void fakeIpv4AndTranslatableIpv6AreReplacedWithValidatedPublicAnswers() throws Exception {
        var calls = new AtomicInteger();
        var resolver = new PublicArticleDnsResolver(host -> new InetAddress[]{ip("198.18.0.200"),ip("::ffff:0:c612:c8")},
                host -> { calls.incrementAndGet(); return new InetAddress[]{ip("183.194.189.103")}; });
        assertEquals("183.194.189.103", resolver.resolve("mp.weixin.qq.com")[0].getHostAddress());
        assertEquals(1, calls.get());
    }

    @Test void privateAnswersAndNumericFakeIpsNeverTriggerIndependentDns() throws Exception {
        for (String target : new String[]{"127.0.0.1","10.0.0.1","169.254.169.254","::1","fc00::1","198.18.0.200","::ffff:0:c612:c8"}) {
            var resolver = new PublicArticleDnsResolver(host -> new InetAddress[]{ip(target)},
                    host -> { fail("Blocked literal/private address must not be re-resolved"); return null; });
            assertThrows(PublicArticleDnsResolver.BlockedAddressException.class, () -> resolver.resolve(target), target);
        }
        var mixed = new PublicArticleDnsResolver(host -> new InetAddress[]{ip("198.18.0.1"), ip("192.168.1.2")},
                host -> { fail("Mixed private answer must be blocked"); return null; });
        assertThrows(PublicArticleDnsResolver.BlockedAddressException.class, () -> mixed.resolve("mixed.example"));
    }

    @Test void fallbackCannotReturnPrivateOrFakeAddresses() {
        for (String answer : new String[]{"127.0.0.1","192.168.0.1","198.18.0.1","::ffff:0:c612:c8"}) {
            var resolver = new PublicArticleDnsResolver(host -> new InetAddress[]{ip("198.18.0.200")},
                    host -> new InetAddress[]{ip(answer)});
            assertThrows(PublicArticleDnsResolver.BlockedAddressException.class, () -> resolver.resolve("mp.weixin.qq.com"));
        }
    }

    @Test void failedSystemDnsIsNotSilentlyReinterpreted() {
        var resolver = new PublicArticleDnsResolver(host -> { throw new UnknownHostException("Missing DNS"); },
                host -> { fail("Only Fake IP answers authorize the fallback"); return null; });
        assertThrows(UnknownHostException.class, () -> resolver.resolve("missing.example"));
    }

    @Test void parsesCnameAndPublicAddressWithoutResolvingNamesFromResponse() throws Exception {
        var response = "{\"Status\":0,\"Answer\":[{\"type\":5,\"data\":\"alias.example\"},{\"type\":1,\"data\":\"183.194.189.103\"}]}";
        assertEquals("183.194.189.103", PublicArticleDnsResolver.parseAnswers(response.getBytes(StandardCharsets.UTF_8),1)[0].getHostAddress());
        for (String value : new String[]{"localhost","127.0.0.1","10.0.0.1","198.18.0.1"}) {
            var bad = "{\"Status\":0,\"Answer\":[{\"type\":1,\"data\":\""+value+"\"}]}";
            assertThrows(IOException.class, () -> PublicArticleDnsResolver.parseAnswers(bad.getBytes(StandardCharsets.UTF_8),1));
        }
    }

    @Test void rejectsFailedOrTruncatedDnsAndMixedPrivateAnswers() {
        for (String response : new String[]{"{}","{\"Status\":3}","{\"Status\":0,\"TC\":true}",
                "{\"Status\":0,\"Answer\":[{\"type\":1,\"data\":\"1.1.1.1\"},{\"type\":1,\"data\":\"127.0.0.1\"}]}",
                "{\"Status\":0,\"Answer\":[{\"type\":28,\"data\":\"::1\"}]}",
                "{\"Status\":0,\"Answer\":[{\"type\":28,\"data\":\"fe80::1%lo0\"}]}"}) {
            assertThrows(IOException.class, () -> PublicArticleDnsResolver.parseAnswers(response.getBytes(StandardCharsets.UTF_8),response.contains("28")?28:1));
        }
    }
}
