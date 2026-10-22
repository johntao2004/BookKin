import { usePermissions } from "../auth/permissions";
import { lazy, Suspense } from "react";
const ThemaSubjectField = lazy(() => import("./ThemaSubjectField").then(module => ({ default: module.ThemaSubjectField })));
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/ui/antd";
import { Button } from "@/ui/buttons";
import { Alert } from "@/ui/feedback";
import { Select, TextField } from "@/ui/forms";
import { Box, FormControl, InputLabel, MenuItem, Stack } from "@/ui/primitives";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useCatalogFilterParams } from "../hooks/useCatalogFilterParams";
import { tokens } from "../theme/generated-tokens";
import { CategoryManagementDialog } from "./CategoryManagementDialog";

export function CatalogAdvancedFilterToggle() {
  const { expanded, updateParam } = useCatalogFilterParams();
  return <Button variant="outlined" aria-expanded={expanded} aria-controls="catalog-advanced-filters"
    onClick={() => updateParam("advanced", expanded ? "0" : "1")}>
    高级筛选
  </Button>;
}

export function CatalogAdvancedFilters() {
  const { user, ready } = useAuth();
  const { categoryId, subjectCode, query, expanded, updateParam, clearFilters, manageOpen, activeCount } = useCatalogFilterParams();
  const categoriesQuery = useQuery({
    queryKey: ["categories", user?.id ?? "anonymous"],
    queryFn: ({ signal }) => api.listCategories({ signal }),
    enabled: ready && (expanded || manageOpen),
  });
  const categories = categoriesQuery.data?.items ?? [];
  const { can } = usePermissions();
  const canManage = can("library.organize") && categoriesQuery.data?.editable;
  return <>
    <Box id="catalog-advanced-filters" component="section" aria-label="高级筛选" hidden={!expanded} sx={{ mb: `${tokens.spacing[4]}px` }}>
      {expanded && <Box sx={{ border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px`, bgcolor: "background.paper", p: `${tokens.spacing[4]}px` }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: `${tokens.spacing[4]}px` }}>
          <TextField label="关键词" placeholder="搜索书名或作者" value={query} onChange={(event: { target: { value: string } }) => updateParam("q", event.target.value)} fullWidth />
          <Suspense fallback={<Skeleton active title={false} paragraph={{ rows: 1 }} />}><ThemaSubjectField filter value={subjectCode ? [subjectCode] : []} onChange={codes => updateParam("subject", codes[0] ?? "")} /></Suspense>
          <Stack sx={{ minWidth: 0, gap: `${tokens.spacing[2]}px` }}>
            <InputLabel htmlFor="catalog-category">自定义分类</InputLabel>
            {categoriesQuery.isPending ? <Skeleton active title={false} paragraph={{ rows: 1 }} /> : categoriesQuery.isError ?
              <Alert severity="error" action={<Button onClick={() => void categoriesQuery.refetch()}>重试</Button>}>分类暂时无法读取</Alert> :
              <FormControl sx={{ minWidth: 0 }}><Select id="catalog-category" label="分类" value={categoryId} showSearch optionFilterProp="label" onChange={(event: { target: { value: string } }) => updateParam("category", event.target.value)}>
                <MenuItem value="">全部分类</MenuItem>
                {categoryId && !categories.some(category => category.id === categoryId) && <MenuItem value={categoryId}>分类已失效或不可见</MenuItem>}
                {categories.map(category => <MenuItem key={category.id} value={category.id}>{`${category.name} · ${category.bookCount} 本`}</MenuItem>)}
              </Select></FormControl>}
          </Stack>
        </Box>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: `${tokens.spacing[3]}px`, mt: `${tokens.spacing[4]}px` }}>
          <Button disabled={!activeCount} onClick={clearFilters}>重置</Button>
          {canManage && <Button variant="outlined" onClick={() => updateParam("manage", "1")}>{categories.length ? "管理分类" : "创建分类"}</Button>}
        </Stack>
      </Box>}
    </Box>
    {canManage && <CategoryManagementDialog open={manageOpen} mode={categories.length ? "manage" : "create"} categories={categories} onClose={() => updateParam("manage", "")} />}
  </>;
}
