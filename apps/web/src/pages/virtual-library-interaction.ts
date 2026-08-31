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
