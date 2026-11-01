import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { permissionCatalog, defaultGrants, rolePermissionApi, type RolePolicy } from "../auth/permissions";
import { Button } from "../ui/buttons";
import { Alert } from "../ui/feedback";
import { Stack, Typography } from "../ui/primitives";
import { DataTable, Skeleton, TreeSelect } from "../ui/antd";
import { useConfirmation } from "../ui/confirmations";
import { Checkbox } from "../ui/forms";
import { tokens } from "../theme/generated-tokens";
import type { UserRole } from "../domain/types";
import { ActionToolbar } from "../components/PageHeader";
import { permissionPageModel, rolePermissionGroups, rolePermissionPages } from "./role-permission-groups";
import type { RolePermissionRouteNode } from "./role-permission-groups";

interface PermissionTreeOption { title: string; value: string; selectable: boolean; children?: PermissionTreeOption[] }

export function RolePermissionsPage() {
  const modal = useConfirmation();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["role-policy"], queryFn: rolePermissionApi.policy });
  const [draft, setDraft] = useState<RolePolicy | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const [selectedPage, setSelectedPage] = useState(rolePermissionPages[0].value);
  const policy = draft ?? query.data;
  if (query.isPending) return <Skeleton active />;
  if (!policy) return <Alert severity="error" action={<Button onClick={() => void query.refetch()}>重试</Button>}>无法读取角色权限。</Alert>;
  const toggleMany = (role: UserRole, codes: string[], enabled: boolean) => {
    if (role === "OWNER") return;
    const values = new Set(policy.grants[role]);
    const eligible = codes.filter(code => permissionCatalog.find(permission => permission.code === code)?.roles.includes(role));
    if (enabled) {
      const enable = (code: string) => {
        permissionCatalog.find(permission => permission.code === code)?.requires.forEach(enable);
        if (permissionCatalog.find(permission => permission.code === code)?.roles.includes(role)) values.add(code);
      };
      eligible.forEach(enable);
    } else {
      eligible.forEach(code => values.delete(code));
      let changed: boolean;
      do { changed = false; permissionCatalog.forEach(permission => { if (values.has(permission.code) && permission.requires.some(required => !values.has(required))) { values.delete(permission.code); changed = true; } }); } while (changed);
    }
    setDraft({ ...policy, grants: { ...policy.grants, [role]: [...values] } }); setMessage("");
  };
  const save = async () => {
    setBusy(true); setError("");
    try {
      const result = await rolePermissionApi.save(policy); client.setQueryData(["role-policy"], result); setDraft(null);
      await client.invalidateQueries({ queryKey: ["role-permissions-current"] }); setMessage("角色权限已保存，对后续请求立即生效。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); } finally { setBusy(false); }
  };
  const roles: UserRole[] = ["ADMIN", "MEMBER"];
  const selectedNode = rolePermissionPages.find(page => page.value === selectedPage);
  const pageModel = selectedNode ? permissionPageModel(selectedNode) : undefined;
  const rows = pageModel ? [
    ...(pageModel.accessCodes.length ? [{ key: "access", label: "页面访问", codes: pageModel.accessCodes }] : []),
    ...pageModel.operations.map(operation => ({ key: operation.label, label: operation.label, codes: operation.codes })),
  ] : [];
  const pageTitle = selectedNode?.title ?? selectedPage;
  const changeCount = roles.reduce((count, role) => count + permissionCatalog.filter(permission =>
    Boolean(policy.grants[role]?.includes(permission.code)) !== Boolean(query.data?.grants[role]?.includes(permission.code))).length, 0);
  const treeNode = (node: RolePermissionRouteNode): PermissionTreeOption => ({
    title: node.title,
    value: node.value,
    selectable: Boolean(node.permissionGroup),
    children: node.children?.map(child => treeNode(child)),
  });
  return <Stack spacing={3}>
    <ActionToolbar>
      <Button disabled={busy} onClick={() => { setDraft({ ...policy, grants: { OWNER: defaultGrants("OWNER"), ADMIN: defaultGrants("ADMIN"), MEMBER: defaultGrants("MEMBER") } }); setMessage(""); }}>恢复全部默认（待保存）</Button>
      <Button disabled={busy} onClick={() => { setDraft(null); setError(""); void query.refetch(); }}>重新加载</Button>
      <Button variant="contained" disabled={!changeCount || busy} onClick={() => modal.confirm({ title: "保存角色权限？", content: "更改会影响该角色的所有账户和已登录会话。", okText: "保存权限", cancelText: "取消", onOk: save })}>保存权限</Button>
    </ActionToolbar>
    {changeCount > 0 && <Typography role="status" color="text.secondary">共 {changeCount} 项权限待保存，切换页面会保留更改。</Typography>}
    {message && <Alert severity="success">{message}</Alert>}{error && <Alert severity="error">{error}</Alert>}
    <Stack spacing={2}>
      <Typography component="label" htmlFor="role-permission-page">选择页面</Typography>
      <TreeSelect id="role-permission-page" aria-label="选择权限页面" value={selectedPage} onChange={setSelectedPage}
        showSearch treeNodeFilterProp="title" treeDefaultExpandAll style={{ width: "100%" }}
        treeData={rolePermissionGroups.map(group => treeNode(group))} />
    </Stack>
    <Stack spacing={2} component="section" aria-label={`${pageTitle}权限`} sx={{ minWidth: 0 }}>
      <Typography component="h3" variant="h6">{pageTitle}</Typography>
      <DataTable key={selectedPage} aria-label={`${pageTitle}角色权限矩阵`} rowKey="key" dataSource={rows}
        tableLayout="fixed" columns={[
          { title: "页面与操作", key: "function", render: (_, row) => <Typography sx={{ overflowWrap: "anywhere" }}>{row.label}</Typography> },
          ...roles.map(role => ({ title: { ADMIN: "管理员", MEMBER: "成员", OWNER: "主人" }[role], key: role, align: "center" as const,
            width: tokens.layout.touchTarget * 2,
            render: (_: unknown, row: typeof rows[number]) => {
              const codes = row.codes.filter(code => permissionCatalog.find(permission => permission.code === code)?.roles.includes(role));
              const enabled = codes.filter(code => policy.grants[role]?.includes(code)).length;
              return <Checkbox aria-label={`${{ ADMIN: "管理员", MEMBER: "成员", OWNER: "主人" }[role]} · ${row.label}`} checked={codes.length > 0 && enabled === codes.length} indeterminate={enabled > 0 && enabled < codes.length} disabled={busy || codes.length === 0} onChange={event => toggleMany(role, codes, event.target.checked)} />;
            } })),
        ]} />
    </Stack>
  </Stack>;
}
