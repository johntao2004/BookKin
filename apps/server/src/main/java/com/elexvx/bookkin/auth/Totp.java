package com.elexvx.bookkin.auth;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** RFC 6238 SHA-1, 30-second steps; compatibility with standard authenticator apps. */
public final class Totp {
    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private Totp() {}
    public static String newSecret() {
        byte[] raw = new byte[20]; new SecureRandom().nextBytes(raw);
        StringBuilder result = new StringBuilder(); int bits=0, value=0;
        for (byte b : raw) {
            value=(value<<8)|(b&255); bits+=8;
            while (bits>=5) { bits-=5; result.append(ALPHABET.charAt((value>>bits)&31)); }
        }
        if (bits>0) result.append(ALPHABET.charAt((value<<(5-bits))&31));
        return result.toString();
    }
    public static String code(String secret, long step, int digits) {
        try {
            byte[] decoded=new byte[secret.length()*5/8]; int bits=0, value=0, at=0;
            for (char c : secret.toCharArray()) {
                int n=ALPHABET.indexOf(c); if(n<0) throw new IllegalArgumentException("Invalid TOTP secret");
                value=(value<<5)|n; bits+=5;
                if(bits>=8) { bits-=8; decoded[at++]=(byte)(value>>bits); }
            }
            Mac mac=Mac.getInstance("HmacSHA1"); mac.init(new SecretKeySpec(decoded,"HmacSHA1"));
            byte[] digest=mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
            int offset=digest[digest.length-1]&15;
            int binary=ByteBuffer.wrap(digest,offset,4).getInt()&0x7fffffff;
            int modulo=digits==8?100_000_000:1_000_000;
            return String.format(java.util.Locale.ROOT,"%0"+digits+"d",binary%modulo);
        } catch (java.security.GeneralSecurityException e) { throw new IllegalStateException(e); }
    }
    public static long match(String secret, String input, long nowMillis, long lastStep) {
        if(input==null || !input.matches("[0-9]{6}")) return -1;
        long current=nowMillis/30_000;
        for(long step=current+1;step>=current-1;step--) {
            if(step>lastStep && step>=0 && MessageDigest.isEqual(code(secret,step,6).getBytes(StandardCharsets.US_ASCII),input.getBytes(StandardCharsets.US_ASCII))) return step;
        }
        return -1;
    }
}
