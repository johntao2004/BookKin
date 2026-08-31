import { useEffect, useRef, useState } from "react";

interface InfiniteScrollTriggerOptions {
  enabled: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}

export function useInfiniteScrollTrigger({
  enabled,
  onLoadMore,
  rootMargin = "900px 0px",
}: InfiniteScrollTriggerOptions) {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!enabled || !trigger) return;
    if (!("IntersectionObserver" in window)) {
      setSupported(false);
      return;
    }

    setSupported(true);
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) onLoadMore();
    }, { rootMargin, threshold: 0 });
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [enabled, onLoadMore, rootMargin]);

  return { triggerRef, supported };
}
