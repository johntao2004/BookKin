package com.elexvx.bookkin.auth;
import static org.assertj.core.api.Assertions.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
class TotpTest {
    private static final String SECRET="GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    @Test void rfc6238Sha1Vectors() {
        long[] times={59,1111111109,1111111111,1234567890,2000000000,20000000000L};
        String[] codes={"94287082","07081804","14050471","89005924","69279037","65353130"};
        for(int i=0;i<times.length;i++) assertThat(Totp.code(SECRET,times[i]/30,8)).isEqualTo(codes[i]);
    }
    @Test void sixDigitsWindowAndReplayProtection() {
        long now=1_800_000;
        assertThat(Totp.match(SECRET,Totp.code(SECRET,59,6),now,-1)).isEqualTo(59);
        assertThat(Totp.match(SECRET,Totp.code(SECRET,61,6),now,-1)).isEqualTo(61);
        assertThat(Totp.match(SECRET,Totp.code(SECRET,58,6),now,-1)).isEqualTo(-1);
        assertThat(Totp.match(SECRET,Totp.code(SECRET,60,6),now,60)).isEqualTo(-1);
        assertThat(Totp.match(SECRET,"abcdef",now,-1)).isEqualTo(-1);
        assertThat(Totp.match(SECRET,"1234567",now,-1)).isEqualTo(-1);
    }
    @Test void ciphertextIsUserBoundAndMissingOrWrongKeysFailClosed() {
        var crypto=new TwoFactorCrypto("test-key"); UUID user=UUID.randomUUID();
        String encrypted=crypto.encrypt(user,SECRET);
        assertThat(encrypted).doesNotContain(SECRET);
        assertThat(crypto.decrypt(user,encrypted)).isEqualTo(SECRET);
        assertThat(crypto.encrypt(user,SECRET)).isNotEqualTo(encrypted);
        assertThatThrownBy(()->crypto.decrypt(UUID.randomUUID(),encrypted)).hasMessageContaining("无法读取");
        assertThatThrownBy(()->new TwoFactorCrypto("other").decrypt(user,encrypted)).hasMessageContaining("无法读取");
        assertThat(new TwoFactorCrypto("").configured()).isFalse();
        assertThatThrownBy(()->new TwoFactorCrypto("").encrypt(user,SECRET)).hasMessageContaining("配置");
    }
}
