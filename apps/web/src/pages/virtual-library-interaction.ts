export const BOOK_POINTER_CLICK_TOLERANCE = 8;

export interface InspectedBookPointerRelease {
  selectedBookId: string | null;
  pressedBookId: string | null;
  releasedBookId: string | null;
  moved: number;
}

export function shouldOpenInspectedBook({
  selectedBookId,
  pressedBookId,
  releasedBookId,
  moved,
}: InspectedBookPointerRelease) {
  return Boolean(
    selectedBookId
      && pressedBookId === selectedBookId
      && releasedBookId === selectedBookId
      && moved < BOOK_POINTER_CLICK_TOLERANCE,
  );
}

/**
 * While a shelf is focused, only that shelf remains an actionable 3D target.
 * A hit on another shelf is treated as blank space so a short click can close
 * the current focus instead of silently switching to a different case.
 */
export function isFocusedShelfTarget(
  focusedShelfSectionId: number | null,
  targetShelfSectionId: number | null,
) {
  return focusedShelfSectionId === null || focusedShelfSectionId === targetShelfSectionId;
}
