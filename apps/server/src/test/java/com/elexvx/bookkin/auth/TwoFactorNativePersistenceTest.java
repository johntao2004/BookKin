package com.elexvx.bookkin.auth;

import static org.assertj.core.api.Assertions.*;
import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.security.Principal;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import org.flywaydb.core.Flyway;
import org.jooq.impl.DSL;
import org.jooq.SQLDialect;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.datasource.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;

@EnabledIfEnvironmentVariable(named="BOOKKIN_NATIVE_TEST_URL",matches=".+")
class TwoFactorNativePersistenceTest {
    String schema,url,user,password; org.jooq.DSLContext db; TwoFactorService service;
    Principal owner=()->"owner", member=()->"member", admin=()->"admin";
    UUID memberId; AtomicLong millis=new AtomicLong(Instant.parse("2026-10-22T12:00:00Z").toEpochMilli());
    Clock clock=new Clock() { public ZoneId getZone(){return ZoneOffset.UTC;} public Clock withZone(ZoneId zone){return this;} public Instant instant(){return Instant.ofEpochMilli(millis.get());} };
    @BeforeEach void setup() throws Exception {
        url=System.getenv("BOOKKIN_NATIVE_TEST_URL");user=System.getenv("BOOKKIN_NATIVE_TEST_USER");password=System.getenv("BOOKKIN_NATIVE_TEST_PASSWORD");
        schema="bookkin_2fa_"+UUID.randomUUID().toString().replace("-","");
        Flyway.configure().dataSource(url,user,password).schemas(schema).defaultSchema(schema).load().migrate();
        var source=new DriverManagerDataSource(url+(url.contains("?")?"&":"?")+"currentSchema="+schema,user,password);
        db=DSL.using(new TransactionAwareDataSourceProxy(source),SQLDialect.POSTGRES);
        var users=new UserRepository(db);var audit=new AuditService(db);var permissions=new RolePermissionService(db,users,audit);
        users.create("owner","主人","password",UserRole.OWNER,false);users.create("admin","管理员","password",UserRole.ADMIN,false);
        memberId=users.create("member","成员","password",UserRole.MEMBER,false).id();
        PasswordEncoder encoder=new PasswordEncoder() { public String encode(CharSequence raw){return raw.toString();} public boolean matches(CharSequence raw,String encoded){return raw.toString().equals(encoded);} };
        var target=new TwoFactorService(db,users,permissions,encoder,new TwoFactorCrypto("native-test-key"),audit,clock);
        var proxy=new ProxyFactory(target);proxy.setProxyTargetClass(true);
        proxy.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(source),new AnnotationTransactionAttributeSource()));
        service=(TwoFactorService)proxy.getProxy();
    }
    @AfterEach void cleanup() throws Exception {
        if(schema!=null) try(var c=DriverManager.getConnection(url,user,password)){c.createStatement().execute("drop schema if exists "+schema+" cascade");}
    }
    String code(TwoFactorService.Enrollment enrollment){return Totp.code(enrollment.secret(),millis.get()/30_000,6);}
    TwoFactorService.Bound bind(MockHttpSession session) {
        var e=service.begin("password",member);return service.confirm(UUID.fromString(e.id()),code(e),member,session);
    }
    void enable(){service.savePolicy(true,service.policy().revision(),owner);}
    void error(String code,Runnable work) {
        assertThatThrownBy(work::run).isInstanceOfSatisfying(ApiException.class,e->assertThat(e.code()).isEqualTo(code));
    }
    @Test void defaultOffOwnerOnlyPolicyAndSessionAndUserBoundAccess() {
        assertThat(service.policy().enabled()).isFalse(); error("VAULT_DISABLED",()->service.requireVaultAccess(member,new MockHttpSession()));
        error("OWNER_REQUIRED",()->service.savePolicy(true,0,admin)); enable();
        error("VAULT_POLICY_CONFLICT",()->service.savePolicy(false,0,owner));
        error("TWO_FACTOR_SETUP_REQUIRED",()->service.requireVaultAccess(member,new MockHttpSession()));
        var session=new MockHttpSession();bind(session);service.requireVaultAccess(member,session);
        error("TWO_FACTOR_REQUIRED",()->service.requireVaultAccess(member,new MockHttpSession()));
        assertThat(service.status(admin,session).verified()).isFalse();
        // Credential binding and policy changes never grant an owner an exemption.
        error("TWO_FACTOR_SETUP_REQUIRED",()->service.requireVaultAccess(owner,new MockHttpSession()));
        service.savePolicy(false,service.policy().revision(),owner);error("VAULT_DISABLED",()->service.requireVaultAccess(member,session));
        enable();error("TWO_FACTOR_REQUIRED",()->service.requireVaultAccess(member,session));
    }
    @Test void enrollmentExpiryPasswordAndSecretStorage() {
        enable();error("PASSWORD_INVALID",()->service.begin("wrong",member));
        assertThat(db.fetchOne("select attempts from two_factor_credentials where user_id=?",memberId).get(0,Integer.class)).isEqualTo(1);
        var expired=service.begin("password",member);millis.addAndGet(601_000);
        error("TWO_FACTOR_ENROLLMENT_EXPIRED",()->service.confirm(UUID.fromString(expired.id()),code(expired),member,new MockHttpSession()));
        var fresh=service.begin("password",member);var codes=service.confirm(UUID.fromString(fresh.id()),code(fresh),member,new MockHttpSession()).recoveryCodes();
        var row=db.fetchOne("select * from two_factor_credentials where user_id=?",memberId);
        assertThat(row.get("secret_ciphertext",String.class)).doesNotContain(fresh.secret());assertThat(row.get("pending_ciphertext")).isNull();
        assertThat(codes).hasSize(10).doesNotHaveDuplicates();
        assertThat(db.fetch("select code_hash from two_factor_recovery_codes where user_id=?",memberId).toString()).doesNotContain(codes.getFirst());
        error("TWO_FACTOR_ENROLLMENT_EXPIRED",()->service.confirm(UUID.fromString(fresh.id()),code(fresh),member,new MockHttpSession()));
    }
    @Test void replayRecoveryLockExpiryAndRebindingRevokeAllSessionGrants() {
        enable();var session=new MockHttpSession();var bound=bind(session);
        service.lock(session);error("TWO_FACTOR_REQUIRED",()->service.requireVaultAccess(member,session));
        var first=bound.recoveryCodes().getFirst();service.verify(first,true,member,session);service.requireVaultAccess(member,session);
        error("TWO_FACTOR_INVALID",()->service.verify(first,true,member,new MockHttpSession()));
        millis.addAndGet(300_001);error("TWO_FACTOR_REQUIRED",()->service.requireVaultAccess(member,session));
        service.verify(bound.recoveryCodes().get(1),true,member,session);
        var other=new MockHttpSession();service.verify(bound.recoveryCodes().get(2),true,member,other);
        service.reset("password",bound.recoveryCodes().get(3),true,member,session);
        error("TWO_FACTOR_SETUP_REQUIRED",()->service.requireVaultAccess(member,other));
        bind(session);error("TWO_FACTOR_REQUIRED",()->service.requireVaultAccess(member,other));
    }
    @Test void onlyOneConcurrentVerificationCanConsumeTheSameTotp() throws Exception {
        enable();var enrollment=service.begin("password",member);service.confirm(UUID.fromString(enrollment.id()),code(enrollment),member,new MockHttpSession());
        // Binding already consumes its code; require the next step for another session.
        error("TWO_FACTOR_INVALID",()->service.verify(code(enrollment),false,member,new MockHttpSession()));
        millis.addAndGet(30_000);String next=code(enrollment);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var start=new CountDownLatch(1);Callable<Boolean> work=()->{start.await();try{service.verify(next,false,member,new MockHttpSession());return true;}catch(ApiException e){assertThat(e.code()).isEqualTo("TWO_FACTOR_INVALID");return false;}};
            var a=pool.submit(work);var b=pool.submit(work);start.countDown();
            assertThat(List.of(a.get(),b.get())).containsExactlyInAnyOrder(true,false);
        }
    }
    @Test void failedAttemptsPersistAcrossServiceCallsAndRecoverAfterWindow() {
        enable();var session=new MockHttpSession();bind(session);
        for(int i=0;i<8;i++) error("TWO_FACTOR_INVALID",()->service.verify("000000",true,member,session));
        error("TWO_FACTOR_RATE_LIMITED",()->service.verify("000000",true,member,session));
        millis.addAndGet(301_000);error("TWO_FACTOR_INVALID",()->service.verify("000000",true,member,session));
    }
    @Test void activeVisitCanRenewButLockedExpiredOrPolicyRevokedVisitsCannot() {
        enable();var session=new MockHttpSession();bind(session);
        millis.addAndGet(240_000);long before=service.status(member,session).expiresAt();
        assertThat(service.renew(member,session).expiresAt()).isGreaterThan(before);
        millis.addAndGet(120_000);service.requireVaultAccess(member,session);
        service.lock(session);error("TWO_FACTOR_REQUIRED",()->service.renew(member,session));
        verifyFreshCode(session);
        millis.addAndGet(300_001);error("TWO_FACTOR_REQUIRED",()->service.renew(member,session));
        verifyFreshCode(session);service.savePolicy(false,service.policy().revision(),owner);
        error("VAULT_DISABLED",()->service.renew(member,session));
    }
    private void verifyFreshCode(MockHttpSession session) {
        // Native fixture obtains a fresh binding without changing existing data outside this isolated schema.
        var row=db.fetchOne("select secret_ciphertext from two_factor_credentials where user_id=?",memberId);
        String secret=new TwoFactorCrypto("native-test-key").decrypt(memberId,row.get(0,String.class));
        millis.addAndGet(30_000);String code=Totp.code(secret,millis.get()/30_000,6);
        service.verify(code,false,member,session);
    }
}
