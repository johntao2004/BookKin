import AntCheckbox from "antd/es/checkbox";
import AntInput from "antd/es/input";
import AntRadio from "antd/es/radio";
import AntSelect from "antd/es/select";
import AntSlider from "antd/es/slider";
import AntSwitch from "antd/es/switch";
import type { ReactNode } from "react";
import { Children, isValidElement, useId } from "react";
import { mergeClassNames, sxClassName, useTheme, type BoxProps, type SxProps } from "./primitives";

export function TextField({ label, helperText, error, multiline, minRows, maxRows, type, value, defaultValue, onChange, sx, className, slotProps, InputProps, placeholder, fullWidth, size: _size, variant: _variant, startAdornment: _startAdornment, ...props }: BoxProps & {
  label?: ReactNode;
  helperText?: ReactNode;
  error?: boolean;
  multiline?: boolean;
  minRows?: number;
  maxRows?: number;
  sx?: SxProps;
  fullWidth?: boolean;
  slotProps?: { input?: Record<string, unknown>; htmlInput?: Record<string, unknown> };
  InputProps?: Record<string, unknown>;
  onChange?: (event: any) => void;
}) {
  const id = useId();
  const slotInput = (slotProps?.input ?? {}) as { startAdornment?: ReactNode; readOnly?: boolean } & Record<string, unknown>;
  const { startAdornment: slotStartAdornment, endAdornment: slotEndAdornment, ...slotInputProps } = slotInput;
  const inputProps = { ...(slotProps?.htmlInput ?? {}), ...slotInputProps };
  const prefix = slotStartAdornment ?? (InputProps as { startAdornment?: ReactNode } | undefined)?.startAdornment;
  const suffix = slotEndAdornment ?? (InputProps as { endAdornment?: ReactNode } | undefined)?.endAdornment;
  const common = {
    ...props,
    id,
    value,
    defaultValue,
    onChange,
    type,
    placeholder,
    required: props.required,
    autoFocus: props.autoFocus,
    autoComplete: props.autoComplete,
    disabled: props.disabled,
    readOnly: Boolean(slotInput.readOnly),
    "aria-label": props["aria-label"] ?? (typeof label === "string" ? label : undefined),
    ...inputProps,
    prefix,
    suffix,
    className: "bk-field-control",
  };
  const control = multiline
    ? <AntInput.TextArea {...(common as any)} autoSize={{ minRows, maxRows }} />
    : type === "password"
      ? <AntInput.Password {...(common as any)} visibilityToggle={suffix ? false : undefined} />
      : <AntInput {...(common as any)} />;
  const fieldClassName = mergeClassNames("bk-field", fullWidth && "bk-field-full", error && "bk-field-error", sxClassName(sx, useTheme()), className);
  return <div className={fieldClassName}>{label && <label htmlFor={id} className="bk-field-label">{label}{props.required ? " *" : ""}</label>}{control}{helperText && <span className="bk-field-helper">{helperText}</span>}</div>;
}


export function Select({ value, defaultValue, onChange, label, children, sx, className, startAdornment, labelId: _labelId, ...props }: BoxProps & { label?: ReactNode; startAdornment?: ReactNode; onChange?: (event: any) => void; labelId?: string }) {
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const item = child.props as { value?: string; children?: ReactNode; disabled?: boolean };
    return item.value === undefined ? [] : [{ value: item.value, label: item.children, disabled: item.disabled }];
  });
  return <AntSelect {...(props as any)} value={value} defaultValue={defaultValue} aria-label={typeof label === "string" ? label : undefined} options={options} prefix={startAdornment} className={mergeClassNames("bk-select", sxClassName(sx, useTheme()), className)} onChange={(nextValue) => onChange?.({ target: { value: nextValue } } as any)} />;
}

export function Checkbox({ checked, defaultChecked, onChange, sx, className, slotProps, ...props }: BoxProps & { slotProps?: { input?: Record<string, unknown> }; onChange?: (event: any) => void }) {
  return <AntCheckbox {...props} checked={checked} defaultChecked={defaultChecked} onChange={onChange} {...(slotProps?.input ?? {})} className={mergeClassNames("bk-checkbox", sxClassName(sx, useTheme()), className)} />;
}

export function Radio({ checked, value, sx, className, slotProps, ...props }: BoxProps & { slotProps?: { input?: Record<string, unknown> }; onChange?: (event: any) => void }) {
  return <AntRadio {...props} value={value} checked={checked} {...(slotProps?.input ?? {})} className={mergeClassNames("bk-radio", sxClassName(sx, useTheme()), className)} />;
}


export function Switch({ checked, defaultChecked, onChange, sx, className, slotProps, ...props }: BoxProps & { slotProps?: { input?: Record<string, unknown> }; onChange?: (event: any, checked: boolean) => void }) {
  return <AntSwitch {...(props as any)} checked={checked} defaultChecked={defaultChecked} onChange={(next: boolean, event: any) => onChange?.({ ...(event ?? {}), target: { ...(event?.target ?? {}), checked: next } }, next)} {...(slotProps?.input ?? {})} className={mergeClassNames("bk-switch", sxClassName(sx, useTheme()), className)} />;
}

export function Slider({ value, defaultValue, onChange, sx, className, ...props }: BoxProps & { value?: number | number[]; defaultValue?: number | number[]; onChange?: (event: any, value: number | number[]) => void }) {
  return <AntSlider {...(props as any)} value={value as any} defaultValue={defaultValue as any} onChange={(nextValue) => onChange?.(undefined, nextValue as number | number[])} className={mergeClassNames("bk-slider", sxClassName(sx, useTheme()), className)} />;
}
