import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { BookMetadataDraft, BookUpload } from "../domain/types";

export type UploadMetadataSaveState = "saved" | "dirty" | "saving" | "error";

export function useBookUploadMetadataAutosave(uploadId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<UploadMetadataSaveState>("saved");
  const [error, setError] = useState("");
  const version = useRef(0);
  const savedVersion = useRef(0);
  const latestDraft = useRef<BookMetadataDraft | null>(null);
  const activeSave = useRef<Promise<void> | null>(null);
  const debounceTimer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  const enabledRef = useRef(enabled);
  const paused = useRef(!enabled);
  const keepaliveRequested = useRef(false);

  enabledRef.current = enabled;

  const setSaveState = useCallback((next: UploadMetadataSaveState, reason = "") => {
    if (!mounted.current) return;
    setState(next);
    setError(reason);
  }, []);

  const clearDebounce = useCallback(() => {
    if (debounceTimer.current !== undefined) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = undefined;
  }, []);

  const flush = useCallback(async (options: { keepalive?: boolean } = {}) => {
    if (options.keepalive) keepaliveRequested.current = true;
    clearDebounce();
    while (savedVersion.current < version.current) {
      if (!activeSave.current) {
        const task = (async () => {
          while (savedVersion.current < version.current) {
            const savingVersion = version.current;
            const snapshot = latestDraft.current;
            if (!snapshot) {
              savedVersion.current = savingVersion;
              continue;
            }
            setSaveState("saving");
            try {
              const bodySize = new Blob([JSON.stringify(snapshot)]).size;
              const keepalive = keepaliveRequested.current && bodySize <= 60_000;
              const savedUpload = await api.updateBookUploadMetadata(uploadId, snapshot, keepalive ? { keepalive: true } : undefined);
              savedVersion.current = savingVersion;
              if (savedUpload.id === uploadId && savingVersion === version.current) {
                await queryClient.cancelQueries({ queryKey: ["book-upload", uploadId] });
                await queryClient.cancelQueries({ queryKey: ["book-uploads"] });
                // Input may change while query cancellation settles; only publish the still-current save.
                if (savingVersion === version.current) {
                  queryClient.setQueryData<BookUpload>(["book-upload", uploadId], current => current?.id === uploadId ? savedUpload : current);
                  queryClient.setQueriesData<BookUpload[]>({ queryKey: ["book-uploads"] }, current => current?.map(item => item.id === uploadId ? savedUpload : item));
                  void queryClient.invalidateQueries({ queryKey: ["book-uploads"] }).catch(() => undefined);
                }
              }
            } catch (reason) {
              // A failed older request must not prevent the newest draft from being saved.
              if (savingVersion < version.current) continue;
              keepaliveRequested.current = false;
              const message = reason instanceof Error ? reason.message : "自动保存失败，请重试。";
              setSaveState("error", message);
              throw reason;
            }
          }
          keepaliveRequested.current = false;
          setSaveState("saved");
        })();
        activeSave.current = task;
        void task.then(
          () => { if (activeSave.current === task) activeSave.current = null; },
          () => { if (activeSave.current === task) activeSave.current = null; },
        );
      }
      await activeSave.current;
    }
  }, [clearDebounce, queryClient, setSaveState, uploadId]);

  const schedule = useCallback((draft: BookMetadataDraft) => {
    latestDraft.current = draft;
    version.current += 1;
    setSaveState("dirty");
    clearDebounce();
    if (!enabledRef.current || paused.current) return;
    debounceTimer.current = window.setTimeout(() => {
      debounceTimer.current = undefined;
      void flush().catch(() => undefined);
    }, 450);
  }, [clearDebounce, flush, setSaveState]);

  const pause = useCallback(() => {
    paused.current = true;
    clearDebounce();
  }, [clearDebounce]);

  const resume = useCallback(() => {
    if (!enabledRef.current) return;
    paused.current = false;
    if (savedVersion.current < version.current) {
      setSaveState("dirty");
      clearDebounce();
      debounceTimer.current = window.setTimeout(() => {
        debounceTimer.current = undefined;
        void flush().catch(() => undefined);
      }, 450);
    }
  }, [clearDebounce, flush, setSaveState]);

  const complete = useCallback(() => {
    paused.current = true;
    clearDebounce();
  }, [clearDebounce]);

  useEffect(() => {
    mounted.current = true;
    const onPageHide = () => {
      if (!enabledRef.current || paused.current || savedVersion.current >= version.current) return;
      void flush({ keepalive: true }).catch(() => undefined);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      mounted.current = false;
      window.removeEventListener("pagehide", onPageHide);
      clearDebounce();
      // React Router navigation keeps the document alive; start the pending save before unmount.
      if (enabledRef.current && !paused.current && savedVersion.current < version.current) void flush().catch(() => undefined);
    };
  }, [clearDebounce, flush]);

  useEffect(() => {
    if (!enabled) pause();
    else if (paused.current) resume();
  }, [enabled, pause, resume]);

  return { state, error, schedule, flush, pause, resume, complete };
}
