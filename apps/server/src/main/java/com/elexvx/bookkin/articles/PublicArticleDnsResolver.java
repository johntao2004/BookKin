package com.elexvx.bookkin.articles;

import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.apache.hc.client5.http.SystemDefaultDnsResolver;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.net.InetAddressUtils;
import org.apache.hc.core5.util.Timeout;
import tools.jackson.databind.ObjectMapper;

/** Resolve proxy Fake IP answers independently, while connecting only to checked public addresses. */
final class PublicArticleDnsResolver extends SystemDefaultDnsResolver {
    private static final List<String> PUBLIC_RESOLVERS = List.of(
            "https://223.5.5.5/resolve", "https://1.1.1.1/dns-query");
    private static final int MAX_DNS_BYTES = 64 * 1024;
    private static final ObjectMapper JSON = new ObjectMapper();

    @FunctionalInterface
    interface Lookup {
        InetAddress[] resolve(String host) throws UnknownHostException;
    }

    static final class BlockedAddressException extends UnknownHostException {
        BlockedAddressException() { super("Only public addresses are allowed"); }
    }

    private final Lookup system;
    private final Lookup independent;

    PublicArticleDnsResolver() {
        this(new SystemDefaultDnsResolver()::resolve, PublicArticleDnsResolver::resolveIndependently);
    }

    PublicArticleDnsResolver(Lookup system, Lookup independent) {
        this.system = system;
        this.independent = independent;
    }

    @Override
    public InetAddress[] resolve(String host) throws UnknownHostException {
        var addresses = system.resolve(host);
        boolean fakeIp = false;
        for (var address : addresses) {
            if (isFakeIp(address)) fakeIp = true;
            else checkPublic(address);
        }
        // Never reinterpret private/loopback answers or numeric addresses through a public resolver.
        if (!fakeIp) return checked(addresses);
        if (InetAddressUtils.isIPv4Address(host) || InetAddressUtils.isIPv6Address(host)) {
            throw new BlockedAddressException();
        }
        return checked(independent.resolve(host));
    }

    private static InetAddress[] checked(InetAddress[] addresses) throws UnknownHostException {
        if (addresses.length == 0) throw new UnknownHostException("No public DNS records");
        for (var address : addresses) checkPublic(address);
        return addresses;
    }

    private static void checkPublic(InetAddress address) throws BlockedAddressException {
        try { PublicWebFetcher.validateAddress(address); }
        catch (UnknownHostException blocked) { throw new BlockedAddressException(); }
    }

    static boolean isFakeIp(InetAddress address) {
        byte[] bytes = address.getAddress();
        if (bytes.length == 16) {
            // Shadowrocket also synthesizes the IPv4-translatable ::ffff:0:198.18.x.x form.
            for (int i = 0; i < 8; i++) if (bytes[i] != 0) return false;
            if ((bytes[8] & 255) != 255 || (bytes[9] & 255) != 255 || bytes[10] != 0 || bytes[11] != 0) return false;
        }
        int offset = bytes.length - 4;
        return (bytes[offset] & 255) == 198 && ((bytes[offset + 1] & 255) == 18 || (bytes[offset + 1] & 255) == 19);
    }

    private static InetAddress[] resolveIndependently(String host) throws UnknownHostException {
        for (var endpoint : PUBLIC_RESOLVERS) {
            try {
                var ipv4 = query(endpoint, host, 1);
                if (ipv4.length != 0) return ipv4;
                var ipv6 = query(endpoint, host, 28);
                if (ipv6.length != 0) return ipv6;
            } catch (BlockedAddressException blocked) {
                throw blocked;
            } catch (IOException | RuntimeException unavailable) {
                // The fixed second resolver is a bounded fallback, never an unchecked target.
            }
        }
        throw new UnknownHostException("Public DNS resolution unavailable");
    }

    private static InetAddress[] query(String endpoint, String host, int type) throws IOException {
        // Fixed literal-IP HTTPS endpoints avoid the same local DNS and retain certificate verification.
        var connections = PoolingHttpClientConnectionManagerBuilder.create()
                .setDefaultConnectionConfig(ConnectionConfig.custom()
                        .setConnectTimeout(Timeout.ofSeconds(4)).setSocketTimeout(Timeout.ofSeconds(4)).build())
                .build();
        try (var client = HttpClients.custom().disableRedirectHandling().disableAutomaticRetries()
                .setConnectionManager(connections)
                .setDefaultRequestConfig(RequestConfig.custom().setConnectionRequestTimeout(Timeout.ofSeconds(4))
                        .setResponseTimeout(Timeout.ofSeconds(4)).build()).build()) {
            var request = new HttpGet(URI.create(endpoint + "?name="
                    + URLEncoder.encode(host, StandardCharsets.UTF_8) + "&type=" + type));
            request.setHeader("Accept", "application/dns-json");
            return client.execute(request, response -> {
                if (response.getCode() != 200 || response.getEntity() == null) throw new IOException("DNS unavailable");
                try (var stream = response.getEntity().getContent()) {
                    byte[] body = stream.readNBytes(MAX_DNS_BYTES + 1);
                    if (body.length > MAX_DNS_BYTES) throw new IOException("DNS response too large");
                    return parseAnswers(body, type);
                }
            });
        }
    }

    static InetAddress[] parseAnswers(byte[] body, int type) throws IOException {
        var root = JSON.readTree(body);
        if (root.path("Status").asInt(-1) != 0 || root.path("TC").asBoolean(false)) throw new IOException("Invalid DNS response");
        var addresses = new ArrayList<InetAddress>();
        for (var answer : root.path("Answer")) {
            if (answer.path("type").asInt() != type) continue;
            String literal = answer.path("data").asString("");
            boolean valid = type == 1 ? InetAddressUtils.isIPv4Address(literal)
                    : type == 28 && !literal.contains("%") && InetAddressUtils.isIPv6Address(literal);
            if (!valid) throw new IOException("DNS address is not a literal");
            var address = InetAddress.getByName(literal);
            checkPublic(address);
            addresses.add(address);
        }
        return addresses.toArray(InetAddress[]::new);
    }
}
