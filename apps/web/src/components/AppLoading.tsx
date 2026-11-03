import { statusTitle } from "../ui/status-title";

/** Shared, truthful loading surface for app startup, auth checks and route chunks. */
export function AppLoading({ label = "正在打开书库…" }: { label?: string }) {
  const title = statusTitle(label);
  return (
    <main className="bk-app-loading" role="status" aria-label={title} aria-live="polite" aria-atomic="true" aria-busy="true">
      <span className="bk-app-loading__brand" aria-hidden="true">BookKin</span>
      <span className="bk-app-loading__indicator" aria-hidden="true" />
      <span className="bk-app-loading__label">{title}</span>
    </main>
  );
}
