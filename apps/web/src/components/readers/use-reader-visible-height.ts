import { useEffect, useState } from "react";

function currentVisibleHeight() {
  if (typeof window === "undefined") return 0;
  return window.visualViewport?.height ?? window.innerHeight;
}

export function useReaderVisibleHeight() {
  const [height, setHeight] = useState(currentVisibleHeight);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setHeight(currentVisibleHeight());
    update();
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
    };
  }, []);

  return height;
}
