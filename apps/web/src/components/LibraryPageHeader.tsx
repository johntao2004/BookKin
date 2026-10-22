import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { FormControl, MenuItem } from "../ui/primitives";
import { Select } from "../ui/forms";
import { tokens } from "../theme/generated-tokens";
import { PageHeader } from "./PageHeader";

// Public and signed-in catalogs share one entry and header without sharing private data.
export function LibraryPageHeader() {
  return <PageHeader eyebrow="LIBRARY" title="藏书阁" />;
}

export function LibraryScopeFilter() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  if (!user) return null;
  return <FormControl sx={{ minWidth: tokens.spacing[20] * 2, flex: { xs: "1 1 0", sm: "0 0 auto" } }}>
    <Select label="馆藏范围" value={params.get("scope") === "public" ? "public" : "all"} onChange={(event: { target: { value: string } }) => {
      setParams(previous => {
        const next = new URLSearchParams(previous);
        if (event.target.value === "public") next.set("scope", "public");
        else next.delete("scope");
        return next;
      });
    }}>
      <MenuItem value="all">全部藏书</MenuItem>
      <MenuItem value="public">公开藏书</MenuItem>
    </Select>
  </FormControl>;
}
