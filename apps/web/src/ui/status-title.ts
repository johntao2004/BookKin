import type { ReactNode } from "react";

// Application status headings omit sentence-ending marks; descriptions and user content keep theirs.
export function statusTitle(value: string): string;
export function statusTitle(value: ReactNode): ReactNode;
export function statusTitle(value: ReactNode): ReactNode {
  return typeof value === "string" ? value.replace(/[。！？.!?…]+\s*$/u, "") : value;
}
