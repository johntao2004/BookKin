import { useEffect, useRef, type ReactNode } from "react";
import { Box } from "../../ui/primitives";
import { tokens } from "../../theme/generated-tokens";
import "./notes.css";

/** CSS columns preserve natural card heights and DOM reading order. Reveal each card only once. */
export function NotesMasonry({ items, label }: { items: { key: string; content: ReactNode }[]; label: string }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!root.current || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.setAttribute("data-note-visible", "true");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.05 });
    for (const card of root.current.children) {
      if (card.getAttribute("data-note-visible") !== "true") {
        card.setAttribute("data-note-visible", "false");
        observer.observe(card);
      }
    }
    return () => observer.disconnect();
  }, [items]);
  return <Box ref={root} component="section" aria-label={label} sx={{ columnCount: { xs: 1, sm: 2, lg: 3, xl: 4 }, columnGap: `${tokens.spacing[5]}px` }}>
    {items.map(item => <div className="bk-note-tile" key={item.key}>{item.content}</div>)}
  </Box>;
}
