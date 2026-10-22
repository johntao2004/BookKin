import type { ReactNode } from "react";
import { FormControl, MenuItem, Stack } from "@/ui/primitives";
import { Select } from "@/ui/forms";
import { tokens } from "../theme/generated-tokens";

interface CatalogSelect {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

/** Collections share the same filter, sort and responsive action layout. */
export function CatalogFilters({ actions, filter, sort, extraTools }: {
  actions?: ReactNode;
  extraTools?: ReactNode;
  filter?: CatalogSelect;
  sort?: CatalogSelect;
}) {
  return <Stack direction="row" sx={{
    width: { xs: "100%", sm: "auto" },
    justifyContent: { xs: "flex-start", sm: "flex-end" },
    alignItems: "center", flexWrap: "wrap", gap: `${tokens.spacing[3]}px`,
  }}>
    {actions && <Stack direction="row" sx={{ width: { xs: "100%", sm: "auto" }, gap: `${tokens.spacing[3]}px`, "& > button": { flex: { xs: 1, sm: "0 0 auto" } } }}>{actions}</Stack>}
    {[filter, sort].filter((control): control is CatalogSelect => Boolean(control)).map((control) => <FormControl key={control.label} sx={{ minWidth: 0, width: tokens.spacing[20] * 2, flex: { xs: "1 1 0", sm: "0 0 auto" } }}>
      <Select label={control.label} value={control.value} onChange={(event: { target: { value: string } }) => control.onChange(event.target.value)}>
        {control.options.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
      </Select>
    </FormControl>)}
    {extraTools && <Stack sx={{ width: { xs: "100%", sm: "auto" }, "& > button": { width: { xs: "100%", sm: "auto" } } }}>{extraTools}</Stack>}
  </Stack>;
}
