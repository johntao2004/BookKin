// 确认框挂载在共享主题内，继承实时配色、圆角和本地化。
// Mount confirmations inside the shared theme to inherit live colors, radii and locale.
import AntModal from "antd/es/modal";
import { createContext, useContext, useMemo, type PropsWithChildren } from "react";

type ConfirmationApi = ReturnType<typeof AntModal.useModal>[0];
const ConfirmationContext = createContext<ConfirmationApi | null>(null);

export function ConfirmationProvider({ children }: PropsWithChildren) {
  const [modal, holder] = AntModal.useModal();
  const centered = useMemo<ConfirmationApi>(() => ({
    ...modal,
    confirm: config => modal.confirm({ centered: true, ...config }),
    info: config => modal.info({ centered: true, ...config }),
    success: config => modal.success({ centered: true, ...config }),
    warning: config => modal.warning({ centered: true, ...config }),
    error: config => modal.error({ centered: true, ...config }),
  }), [modal]);
  return <ConfirmationContext.Provider value={centered}>{children}{holder}</ConfirmationContext.Provider>;
}

export function useConfirmation() {
  const modal = useContext(ConfirmationContext);
  if (!modal) throw new Error("ConfirmationProvider is required.");
  return modal;
}
