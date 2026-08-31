import { tokens } from "../../theme/generated-tokens";

export const READER_SWIPE_THRESHOLD = tokens.layout.touchTarget;

export function isEditableReaderTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.isContentEditable || element?.closest("input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog']"));
}

export function isReaderSwipe(startX: number | null, endX: number) {
  return startX !== null && Math.abs(endX - startX) >= READER_SWIPE_THRESHOLD;
}
