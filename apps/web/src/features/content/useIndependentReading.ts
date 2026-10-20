import { useCallback, useEffect, useRef, useState } from "react";
import { type ReadingState } from "./api";
/** No dependency on book persistence, analytics, localStorage or session-save queues. */
export function useIndependentReading(
  initial: ReadingState,
  save: (state: ReadingState) => Promise<void>,
) {
  const [state, setState] = useState(initial),
    [error, setError] = useState("");
  const current = useRef(initial),
    persist = useRef(save),
    dirty = useRef(false),
    saving = useRef<Promise<void> | null>(null);
  useEffect(() => {
    persist.current = save;
  }, [save]);
  const change = useCallback((fn: (previous: ReadingState) => ReadingState) => {
    current.current = fn(current.current);
    dirty.current = true;
    setState(current.current);
  }, []);
  const flush = useCallback(async () => {
    if (saving.current) await saving.current;
    if (!dirty.current) return;
    const snapshot = current.current;
    dirty.current = false;
    saving.current = persist
      .current(snapshot)
      .catch((e) => {
        dirty.current = true;
        setError(e instanceof Error ? e.message : "保存失败");
        throw e;
      })
      .finally(() => {
        saving.current = null;
      });
    await saving.current;
  }, []);
  useEffect(() => {
    let last = performance.now(),
      active = Date.now();
    const activity = () => {
      active = Date.now();
    };
    const timer = window.setInterval(() => {
      const now = performance.now();
      const seconds = Math.min(2, (now - last) / 1000);
      last = now;
      if (
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        Date.now() - active < 60000
      )
        change((s) => ({ ...s, seconds: s.seconds + seconds }));
    }, 1000);
    const autosave = window.setInterval(() => {
      void flush().catch(() => undefined);
    }, 10000);
    const hide = () => {
      if (document.hidden) void flush().catch(() => undefined);
    };
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearInterval(timer);
      clearInterval(autosave);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      document.removeEventListener("visibilitychange", hide);
      void flush().catch(() => undefined);
    };
  }, [change, flush]);
  return { state, change, flush, error };
}
