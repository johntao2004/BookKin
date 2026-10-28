import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { MetadataTerm, MetadataTermInput, MetadataTermKind } from "../domain/types";

/** Shared server-backed options; creating an option is independent of committing a book. */
export function useMetadataTerms(kind: MetadataTermKind, { enabled = true }: { enabled?: boolean } = {}) {
  const client = useQueryClient();
  const { mutateAsync: ensureTerms } = useMutation({ mutationKey: ["metadata-term-save"], mutationFn: (items: MetadataTermInput[]) => api.ensureMetadataTerms(kind, items) });
  const [searchText, search] = useState("");
  const [query, setQuery] = useState("");
  const [isSaving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const operation = useRef(0);
  const mounted = useRef(true);
  const lastRetry = useRef<(() => Promise<void>) | undefined>(undefined);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchText.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [searchText]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operation.current += 1; };
  }, []);
  const result = useQuery({
    queryKey: ["metadata-terms", kind, query],
    queryFn: ({ signal }) => api.listMetadataTerms(kind, query, signal),
    enabled, staleTime: 30_000, retry: false,
  });
  const commit = useCallback(async (items: MetadataTermInput[], onSaved: (terms: MetadataTerm[]) => void) => {
    const values = items.map(item => ({ value: item.value.trim(), label: item.label.trim() })).filter(item => item.value && item.label);
    const run = async () => {
      const version = ++operation.current;
      if (mounted.current) { setSaving(true); setSaveError(""); }
      try {
        const terms: MetadataTerm[] = [];
        for (let offset = 0; offset < values.length; offset += 50) {
          const response = await ensureTerms(values.slice(offset, offset + 50));
          terms.push(...response.items);
        }
        client.setQueriesData<{ items: MetadataTerm[] }>({ queryKey: ["metadata-terms", kind] }, current => current ? {
          items: [...new Map([...current.items, ...terms].map(term => [term.id, term])).values()],
        } : current);
        void client.invalidateQueries({ queryKey: ["metadata-terms", kind] });
        if (mounted.current && version === operation.current) { lastRetry.current = undefined; onSaved(terms); }
      } catch (failure) {
        if (mounted.current && version === operation.current) {
          lastRetry.current = run;
          setSaveError(failure instanceof Error ? failure.message : "选项保存失败，请重试。");
        }
      } finally {
        if (mounted.current && version === operation.current) setSaving(false);
      }
    };
    await run();
  }, [client, kind, ensureTerms]);
  const retry = () => { if (lastRetry.current) void lastRetry.current(); else void result.refetch(); };
  return { options: result.data?.items ?? [], search, commit, isLoading: enabled && result.isPending,
    isSaving, error: saveError || (result.isError ? "共享选项暂时无法读取。" : ""), retry };
}
