import { Box } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import type { PropsWithChildren } from "react";
import { tokens } from "../theme/generated-tokens";

const REVEAL_DURATION_MS = 360;
const REVEAL_STAGGER_MS = 45;
const MAX_STAGGER_INDEX = 8;

const riseIntoView = keyframes({
  from: {
    opacity: 0,
    transform: `translateY(${tokens.spacing[6]}px)`,
  },
  to: {
    opacity: 1,
    transform: "translateY(0)",
  },
});

export interface PaginatedItem<T> {
  item: T;
  pageIndex: number;
  itemIndex: number;
}

export function flattenUniquePaginatedItems<T extends { id: string }>(pages: Array<{ items: T[] }> | undefined): PaginatedItem<T>[] {
  const seen = new Set<string>();
  return (pages ?? []).flatMap((page, pageIndex) => page.items.flatMap((item, itemIndex) => {
    if (seen.has(item.id)) return [];
    seen.add(item.id);
    return [{ item, pageIndex, itemIndex }];
  }));
}

export function revealDelay(order: number) {
  return Math.min(Math.max(0, order), MAX_STAGGER_INDEX) * REVEAL_STAGGER_MS;
}

export function PaginatedItemReveal({ animate, order, children }: PropsWithChildren<{ animate: boolean; order: number }>) {
  const delay = revealDelay(order);
  return (
    <Box
      data-lazy-load-reveal={animate ? "true" : "false"}
      data-reveal-delay-ms={animate ? delay : undefined}
      sx={{
        minWidth: 0,
        ...(animate ? {
          opacity: 0,
          animation: `${riseIntoView} ${REVEAL_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
          animationDelay: `${delay}ms`,
          "@media (prefers-reduced-motion: reduce)": {
            opacity: 1,
            animation: "none",
          },
        } : {}),
      }}
    >
      {children}
    </Box>
  );
}
