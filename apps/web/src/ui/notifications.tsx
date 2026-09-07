import notification from "antd/es/notification";
import { createContext, useContext, useEffect, useId, useRef, type PropsWithChildren, type ReactNode } from "react";

type NoticeApi = ReturnType<typeof notification.useNotification>[0];
const NoticeContext = createContext<NoticeApi | null>(null);

export function FeedbackProvider({ children }: PropsWithChildren) {
  const [api, holder] = notification.useNotification({ placement: "topRight" });
  return <NoticeContext.Provider value={api}>{holder}{children}</NoticeContext.Provider>;
}

export function FeedbackBubble({ children, severity = "info", action, duration = 0, onClose }: {
  children: ReactNode;
  severity?: "error" | "info" | "success" | "warning";
  action?: ReactNode;
  duration?: number;
  onClose?: () => void;
}) {
  const api = useContext(NoticeContext);
  const key = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Updating the same key replaces content rather than stacking duplicate notices.
  useEffect(() => {
    api?.open({ key, type: severity, title: children, actions: action, duration,
      role: severity === "error" || severity === "warning" ? "alert" : "status",
      onClose: () => closeRef.current?.() });
  }, [api, key, severity, children, action, duration]);
  useEffect(() => () => api?.destroy(key), [api, key]);
  return null;
}
