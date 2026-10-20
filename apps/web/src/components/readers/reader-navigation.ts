// 过滤可编辑目标上的快捷键并识别横向滑动，避免阅读导航抢占表单输入。
// Filters editable targets and recognizes horizontal swipes so reader navigation does not hijack text input.
import { tokens } from "../../theme/generated-tokens";

export const READER_SWIPE_THRESHOLD = tokens.layout.touchTarget;

export function isEditableReaderTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.isContentEditable || element?.closest("input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog']"));
}

export function isReaderSwipe(startX: number | null, endX: number) {
  return startX !== null && Math.abs(endX - startX) >= READER_SWIPE_THRESHOLD;
}
