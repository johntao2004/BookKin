package com.elexvx.bookkin.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;
import com.elexvx.bookkin.audit.AuditService;
import com.elexvx.bookkin.common.ApiException;
import com.elexvx.bookkin.users.*;
import com.elexvx.bookkin.filemanagement.*;
import com.elexvx.bookkin.catalog.BookRepository;
import com.elexvx.bookkin.ingestion.LibraryRootRepository;
import java.sql.*;
import java.util.*;
import java.security.Principal;
import org.flywaydb.core.Flyway;
import org.jooq.impl.DSL;
import org.jooq.SQLDialect;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.mock.web.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

@EnabledIfEnvironmentVariable(named="BOOKKIN_NATIVE_TEST_URL", matches=".+")
class RolePermissionsNativePersistenceTest {
    Connection connection; org.jooq.DSLContext db; String schema;
    UserRepository users; RolePermissionService permissions; UserRoleService roles;
    UUID ownerId, adminId, memberId;
    Principal owner = () -> "owner", admin = () -> "admin", member = () -> "member";
    @BeforeEach void setup() throws Exception {
        String url=System.getenv("BOOKKIN_NATIVE_TEST_URL"), user=System.getenv("BOOKKIN_NATIVE_TEST_USER"), password=System.getenv("BOOKKIN_NATIVE_TEST_PASSWORD");
        connection=DriverManager.getConnection(url,user,password); schema="bookkin_rbac_"+UUID.randomUUID().toString().replace("-", "");
        connection.createStatement().execute("create schema "+schema);
        Flyway.configure().dataSource(url,user,password).schemas(schema).defaultSchema(schema).load().migrate();
        connection.createStatement().execute("set search_path to "+schema+",public"); db=DSL.using(connection,SQLDialect.POSTGRES);
        users=new UserRepository(db); var audit=new AuditService(db); permissions=new RolePermissionService(db,users,audit); roles=new UserRoleService(users,audit);
        ownerId=users.create("owner","主人","test",UserRole.OWNER,false).id(); adminId=users.create("admin","管理员","test",UserRole.ADMIN,false).id(); memberId=users.create("member","成员","test",UserRole.MEMBER,false).id();
    }
    @AfterEach void cleanup() throws Exception {
        SecurityContextHolder.clearContext();
        if (connection != null) { connection.createStatement().execute("set search_path to public"); connection.createStatement().execute("drop schema "+schema+" cascade"); connection.close(); }
    }
    RolePermissionService.Policy without(UserRole role, String code) {
        var current=permissions.policy(); var grants=new EnumMap<UserRole,Set<String>>(UserRole.class);
        for(var r:List.of(UserRole.ADMIN,UserRole.MEMBER)) grants.put(r,new HashSet<>(current.grants().get(r)));
        grants.get(role).remove(code); permissions.definitions().stream().filter(d->d.requires().contains(code)).forEach(d->grants.get(role).remove(d.code()));
        return new RolePermissionService.Policy(current.revision(),grants);
    }
    @Test void defaultsPersistRevocationsConflictAndAudit() {
        assertThat(permissions.snapshot(member).grants()).contains("reader.read","notes.edit").doesNotContain("library.edit","roles.manage");
        assertThat(permissions.snapshot(admin).grants()).contains("library.edit").doesNotContain("settings.recycle.purge","roles.manage");
        var input=without(UserRole.ADMIN,"knowledge.generate"); var saved=permissions.update(input,owner);
        assertThat(saved.revision()).isEqualTo(1);
        assertThat(new RolePermissionService(db,users,new AuditService(db)).snapshot(admin).grants()).doesNotContain("knowledge.generate");
        assertThat(assertThrows(ApiException.class,()->permissions.update(input,owner)).code()).isEqualTo("ROLE_POLICY_CONFLICT");
        assertThat(db.fetchCount(db.selectFrom("audit_events").where("event_type = 'ROLE_PERMISSIONS_UPDATED'"))).isEqualTo(1);
        assertThat(permissions.snapshot(owner).grants()).contains("roles.manage","settings.recycle.purge");
    }
    @Test void nonOwnerCannotConfigureAndRoleCeilingsAndDependenciesAreEnforced() {
        assertThat(assertThrows(ApiException.class,()->permissions.update(without(UserRole.ADMIN,"knowledge.generate"),admin)).code()).isEqualTo("OWNER_REQUIRED");
        var escalation=without(UserRole.MEMBER,"notes.edit"); escalation.grants().get(UserRole.MEMBER).add("library.files");
        assertThat(assertThrows(ApiException.class,()->permissions.update(escalation,owner)).code()).isEqualTo("ROLE_PERMISSION_CEILING");
        var dependency=without(UserRole.ADMIN,"library.view"); dependency.grants().get(UserRole.ADMIN).add("library.edit");
        assertThat(assertThrows(ApiException.class,()->permissions.update(dependency,owner)).code()).isEqualTo("PERMISSION_DEPENDENCY");
    }
    @Test void assignmentsProtectOwnerAndPreventPrivilegeEscalationAndLostUpdates() {
        assertThat(assertThrows(ApiException.class,()->roles.change(memberId,UserRole.MEMBER,UserRole.ADMIN,admin)).code()).isEqualTo("OWNER_REQUIRED");
        assertThat(assertThrows(ApiException.class,()->roles.change(ownerId,UserRole.OWNER,UserRole.MEMBER,owner)).code()).isEqualTo("OWNER_ROLE_FIXED");
        assertThat(assertThrows(ApiException.class,()->roles.change(memberId,UserRole.MEMBER,UserRole.OWNER,owner)).code()).isEqualTo("OWNER_ROLE_FIXED");
        assertThat(roles.change(memberId,UserRole.MEMBER,UserRole.ADMIN,owner).role()).isEqualTo(UserRole.ADMIN);
        assertThat(assertThrows(ApiException.class,()->roles.change(memberId,UserRole.MEMBER,UserRole.ADMIN,owner)).code()).isEqualTo("USER_ROLE_CONFLICT");
    }
    MockHttpServletResponse request(String name, String uri) throws Exception {
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(name,null,List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        var response=new MockHttpServletResponse();
        new RolePermissionFilter(users,permissions).doFilter(new MockHttpServletRequest("GET",uri),response,(req,res)->res.getWriter().write("allowed")); return response;
    }
    @Test void directApiAndHistoricalSessionsUseCurrentRoleAndGrantsWithoutRelogin() throws Exception {
        assertThat(request("admin","/api/v1/users").getStatus()).isEqualTo(200);
        permissions.update(without(UserRole.ADMIN,"settings.users.view"),owner);
        assertThat(request("admin","/api/v1/users").getStatus()).isEqualTo(403);
        assertThat(request("member","/api/v1/users").getStatus()).isEqualTo(403);
        roles.change(adminId,UserRole.ADMIN,UserRole.MEMBER,owner);
        assertThat(request("admin","/api/v1/role-permissions").getStatus()).isEqualTo(403);
        assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream().map(a -> a.getAuthority()).toList()).containsExactly("ROLE_MEMBER");
        users.toggleStatus(memberId);
        assertThat(request("member","/api/v1/books").getStatus()).isEqualTo(401);
    }
    @Test void savedFilePreviewsCannotBypassRevokedActionOrMemberCeiling() {
        var operations=mock(FileOperationRepository.class);
        var service=new FileOperationService(mock(BookRepository.class),mock(LibraryRootRepository.class),users,operations,mock(PathPolicy.class),mock(FileFingerprints.class),mock(FileLeaseRepository.class),mock(RecycleBinRepository.class),permissions);
        var token=UUID.randomUUID(); var preview=new FileOperationRepository.PreviewRecord(token,adminId,FileOperationType.TRASH,UUID.randomUUID(),null,null,null,null,"book.epub",null,"fingerprint",0,"[]","[]",java.time.OffsetDateTime.now().plusMinutes(1));
        when(operations.findIdempotency(any(),any())).thenReturn(Optional.empty()); when(operations.findPreview(token)).thenReturn(Optional.of(preview));
        permissions.update(without(UserRole.ADMIN,"library.trash"),owner);
        assertThat(assertThrows(ApiException.class,()->service.execute(new FileOperationModels.ExecuteRequest(token,"fingerprint"),"rbac-test",admin)).code()).isEqualTo("PERMISSION_DENIED");
        assertThat(assertThrows(ApiException.class,()->service.preview(new FileOperationModels.PreviewRequest(null,FileOperationType.MOVE,null,null,"fp",null,null),member)).code()).isEqualTo("PERMISSION_DENIED");
        verify(operations,never()).create(any(),any(),any());
    }
    @Test void operationHistoryPagesReachBeyondTheOldRecentLimitWithStableTieOrdering() {
        var history = new FileOperationRepository(db, new com.elexvx.bookkin.config.BookKinProperties(null,null,null,null,null,null,null,null,null,null,null));
        for (int i=0;i<121;i++) db.execute("insert into file_operations(id,idempotency_key,requested_by,operation_type,status,source_path,expected_fingerprint,created_at) values (?,?,?,'RENAME','SUCCEEDED',?,'test',timestamp with time zone '2026-10-22 00:00:00+00')",
            new UUID(0,i+1),"page-fixture-"+i,ownerId,"test-"+i+".epub");
        assertThat(history.count()).isEqualTo(121);
        var seen=new HashSet<UUID>();
        for (int page=0;page<13;page++) for (var row:history.page(page,10)) assertThat(seen.add(row.id())).isTrue();
        assertThat(seen).hasSize(121);
        assertThat(history.page(0,10).getFirst().id()).isEqualTo(new UUID(0,121));
        assertThat(history.page(12,10)).hasSize(1);
        assertThat(history.page(13,10)).isEmpty();
    }

}
