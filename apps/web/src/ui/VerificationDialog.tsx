import { type ReactNode, useEffect, useRef } from "react";
import AntInput from "antd/es/input";
import AntModal from "antd/es/modal";
import AntAlert from "antd/es/alert";
import type { OTPRef } from "antd/es/input/OTP";
import { tokens } from "../theme/generated-tokens";
import "./verification.css";

export function VerificationDialog({ title, description, error, onCancel, children }: {
  title: string; description: string; error?: string; onCancel: () => void; children: ReactNode;
}) {
  return <AntModal open centered title={title} width={tokens.layout.touchTarget * 10} footer={null} destroyOnHidden onCancel={onCancel}
    classNames={{ header: "bk-verification-heading", body: "bk-verification-body" }}>
    <p className="bk-verification-description">{description}</p>
    {error && <AntAlert type="error" title={error} showIcon />}
    {children}
  </AntModal>;
}

/** Native Ant OTP keeps paste, keyboard navigation and autofill in one shared control. */
export function OneTimeCodeInput({ value, onInput, onComplete, disabled, invalid, label = "6 位动态码" }: {
  value: string; onInput: (value: string) => void; onComplete?: (value: string) => void;
  disabled?: boolean; invalid?: boolean; label?: string;
}) {
  return <VerificationCodeInput value={value} onInput={onInput} onComplete={onComplete} disabled={disabled} invalid={invalid}
    label={label} length={6} inputMode="numeric" formatter={text => text.replace(/\D/g, "")} />;
}

/** Recovery codes keep their full 128-bit value, displayed as four rows of eight cells. */
export function RecoveryCodeInput({ value, onInput, disabled, invalid }: {
  value: string; onInput: (value: string) => void; disabled?: boolean; invalid?: boolean;
}) {
  return <VerificationCodeInput value={value} onInput={onInput} disabled={disabled} invalid={invalid}
    label="32 位备用码" length={32} inputMode="text" recovery formatter={text => text.replace(/[^0-9a-f]/gi, "").toUpperCase()} />;
}

function VerificationCodeInput({ value, onInput, onComplete, disabled, invalid, label, length, inputMode, formatter, recovery }: {
  value: string; onInput: (value: string) => void; onComplete?: (value: string) => void;
  disabled?: boolean; invalid?: boolean; label: string; length: number; inputMode: "numeric" | "text";
  formatter: (text: string) => string; recovery?: boolean;
}) {
  const ref = useRef<OTPRef>(null);
  const pastedFocus = useRef<number | null>(null);
  useEffect(() => {
    if (disabled) return;
    if (!value) { ref.current?.focus(); pastedFocus.current = null; return; }
    const target = pastedFocus.current ?? (value.length === length ? length - 1 : null);
    pastedFocus.current = null;
    if (target === null) return;
    // Ant mirrors controlled values in an effect; focus only once the cells have committed.
    const frame = requestAnimationFrame(() => ref.current?.nativeElement.querySelectorAll("input")[target]?.focus());
    return () => cancelAnimationFrame(frame);
  }, [disabled, value, length]);
  return <div className="bk-verification-code"
    onPasteCapture={event => {
      // Normalize before Ant distributes characters, so printed separators never consume a cell.
      event.preventDefault(); event.stopPropagation();
      if (disabled) return;
      const pasted = formatter(event.clipboardData.getData("text"));
      if (!pasted || pasted.length > length) return;
      const fields = Array.from(ref.current?.nativeElement.querySelectorAll("input") ?? []);
      const start = pasted.length === length ? 0 : Math.max(0, fields.indexOf(event.target as HTMLInputElement));
      const next = (value.slice(0, start) + pasted + value.slice(start + pasted.length)).slice(0, length);
      pastedFocus.current = Math.min(start + pasted.length, length - 1);
      onInput(next);
      if (next.length === length) onComplete?.(next);
    }}>
    <AntInput.OTP ref={ref} aria-label={label} length={length} value={value} disabled={disabled}
    className={recovery ? "bk-one-time-code bk-recovery-code" : "bk-one-time-code"} size="large" inputMode={inputMode}
    autoComplete={recovery ? "off" : "one-time-code"} autoCapitalize={recovery ? "characters" : undefined} spellCheck={false}
    status={invalid ? "error" : undefined} formatter={formatter}
    onInput={cells => onInput(cells.join(""))} onChange={onComplete} />
  </div>;
}
