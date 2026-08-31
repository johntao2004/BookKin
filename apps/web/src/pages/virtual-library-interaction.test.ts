import {
  BOOK_POINTER_CLICK_TOLERANCE,
  shouldOpenInspectedBook,
} from "./virtual-library-interaction";

describe("virtual library inspected-book pointer action", () => {
  it("opens the reader only after a short press and release on the selected book", () => {
    expect(shouldOpenInspectedBook({
      selectedBookId: "book-1",
      pressedBookId: "book-1",
      releasedBookId: "book-1",
      moved: BOOK_POINTER_CLICK_TOLERANCE - 0.1,
    })).toBe(true);
  });

  it("keeps a drag in inspection mode instead of opening the reader", () => {
    expect(shouldOpenInspectedBook({
      selectedBookId: "book-1",
      pressedBookId: "book-1",
      releasedBookId: "book-1",
      moved: BOOK_POINTER_CLICK_TOLERANCE,
    })).toBe(false);
  });

  it("does not open when the pointer is released away from the inspected book", () => {
    expect(shouldOpenInspectedBook({
      selectedBookId: "book-1",
      pressedBookId: "book-1",
      releasedBookId: null,
      moved: 1,
    })).toBe(false);
  });

  it("does not mistake another shelf book for the active inspection target", () => {
    expect(shouldOpenInspectedBook({
      selectedBookId: "book-1",
      pressedBookId: "book-2",
      releasedBookId: "book-2",
      moved: 0,
    })).toBe(false);
  });
});
