import AntButton, { type ButtonProps } from "antd/es/button";
import { forwardRef } from "react";

export type ActionIntent = "normal" | "warning" | "danger";
export type ActionButtonProps = ButtonProps & { intent?: ActionIntent };

/** Shared action semantics for both native Ant and compatibility buttons. */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  { intent = "normal", danger, ...props }, ref,
) {
  const resolvedIntent = danger ? "danger" : intent;
  return <AntButton {...props} ref={ref} data-intent={resolvedIntent} danger={resolvedIntent === "danger"} />;
});
