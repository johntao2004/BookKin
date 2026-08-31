import { tokens } from "../../theme/generated-tokens";

export const READER_PROGRESS_HEIGHT = 2;
export const READER_HEADER_BORDER_HEIGHT = 1;
export const READER_TOP_OFFSET = tokens.layout.navHeight + READER_PROGRESS_HEIGHT + READER_HEADER_BORDER_HEIGHT;
export const READER_CONTENT_HEIGHT = `calc(100dvh - ${READER_TOP_OFFSET}px)`;
export const READER_PAGE_HEIGHT = `calc(100dvh - ${READER_TOP_OFFSET}px - ${tokens.layout.readerControlHeight}px - ${tokens.layout.readerViewportBottom}px)`;
