import { useSearchParams } from "react-router-dom";

export function useCatalogFilterParams() {
  const [params, setParams] = useSearchParams();
  const categoryId = params.get("category") ?? "";
  const subjectCode = params.get("subject") ?? "";
  const query = params.get("q") ?? "";
  const format = params.get("format") ?? "ALL";
  const sortValue = params.get("sort");
  const sort: "recent" | "title" | "author" = sortValue === "title" || sortValue === "author" ? sortValue : "recent";
  const expanded = params.get("advanced") === "1" || (params.get("advanced") !== "0" && Boolean(categoryId || subjectCode || params.get("manage") === "1"));
  const updateParam = (key: string, value: string, defaultValue = "") => {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (!value || value === defaultValue) next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  };
  const clearFilters = () => setParams(previous => {
    const next = new URLSearchParams(previous);
    ["q", "format", "category", "subject"].forEach(key => next.delete(key));
    return next;
  }, { replace: true });
  return { categoryId, subjectCode, query, format, sort, expanded, updateParam, clearFilters,
    manageOpen: params.get("manage") === "1",
    activeCount: Number(Boolean(subjectCode)) + Number(Boolean(categoryId)) + Number(Boolean(query.trim())) + Number(format !== "ALL"),
  };
}
