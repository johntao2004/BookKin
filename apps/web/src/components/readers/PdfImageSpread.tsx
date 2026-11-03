import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { Alert, CircularProgress } from "@/ui/feedback";
import { Box, Stack, Typography } from "@/ui/primitives";
import { tokens } from "../../theme/generated-tokens";

type PageSize = { width: number; height: number };

// Fit the complete spread, rather than centering each page in an equal-width slot.
export function pdfImageSpreadLayout(pages: PageSize[], width: number, height: number) {
  const naturalWidth = pages.reduce((sum, page) => sum + page.width, 0);
  const naturalHeight = Math.max(0, ...pages.map(page => page.height));
  const scale = naturalWidth > 0 && naturalHeight > 0
    ? Math.max(0, Math.min(width / naturalWidth, height / naturalHeight)) : 0;
  return { width: naturalWidth * scale, height: naturalHeight * scale, scale };
}

export function PdfImageSpread({ document, pageNumber, spread, muted }: {
  document: PDFDocumentProxy; pageNumber: number; spread: boolean; muted: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    setPages([]);
    setError("");
    const numbers = [pageNumber, ...(spread && pageNumber < document.numPages ? [pageNumber + 1] : [])];
    void Promise.all(numbers.map(number => document.getPage(number))).then(result => {
      if (!disposed) setPages(result);
    }).catch(reason => { if (!disposed) setError(reason instanceof Error ? reason.message : "PDF 图片页读取失败"); });
    return () => { disposed = true; };
  }, [document, pageNumber, spread]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setSize({ width: host.clientWidth, height: host.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const layout = pdfImageSpreadLayout(pages.map(page => page.getViewport({ scale: 1 })), size.width, size.height);
  return <Box ref={hostRef} className="pdf-image-spread" sx={{ position: "relative", width: "100%", height: "100%", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
    {error ? <Alert severity="error">{error}</Alert> : <Box className="pdf-image-spread-pages" sx={{ display: "flex", flex: "0 0 auto", alignItems: "center", width: `${layout.width}px`, height: `${layout.height}px` }}>
      {pages.map((page, index) => <PdfImageCanvas key={`${pageNumber + index}`} page={page} pageNumber={pageNumber + index} scale={layout.scale} muted={muted} />)}
    </Box>}
    {!error && pages.length === 0 && <CircularProgress size={tokens.spacing[8]} />}
  </Box>;
}

function PdfImageCanvas({ page, pageNumber, scale, muted }: { page: PDFPageProxy; pageNumber: number; scale: number; muted: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const viewport = page.getViewport({ scale });
  useEffect(() => {
    if (scale <= 0) return;
    let disposed = false;
    setLoading(true);
    setError("");
    // Render into a private buffer so a resize never reuses a canvas still owned by PDF.js.
    const buffer = window.document.createElement("canvas");
    const outputScale = window.devicePixelRatio || 1;
    const nextViewport = page.getViewport({ scale });
    buffer.width = Math.max(1, Math.ceil(nextViewport.width * outputScale));
    buffer.height = Math.max(1, Math.ceil(nextViewport.height * outputScale));
    const context = buffer.getContext("2d", { alpha: false });
    if (!context) {
      setError("浏览器无法创建 PDF 图片画布");
      setLoading(false);
      return;
    }
    const task = page.render({ canvas: buffer, canvasContext: context, viewport: nextViewport, transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0] });
    void task.promise.then(() => {
      const canvas = canvasRef.current;
      if (disposed || !canvas) return;
      canvas.width = buffer.width;
      canvas.height = buffer.height;
      canvas.getContext("2d", { alpha: false })?.drawImage(buffer, 0, 0);
      setLoading(false);
    }).catch(reason => {
      if (!disposed && reason?.name !== "RenderingCancelledException") {
        setError(reason instanceof Error ? reason.message : "PDF 图片页渲染失败");
        setLoading(false);
      }
    });
    return () => { disposed = true; task.cancel(); };
  }, [page, scale]);

  return <Box sx={{ position: "relative", flex: "0 0 auto", width: `${viewport.width}px`, height: `${viewport.height}px` }}>
    <Box component="canvas" ref={canvasRef} role="img" aria-label={`PDF 第 ${pageNumber} 页图片`} sx={{ display: error ? "none" : "block", width: "100%", height: "100%" }} />
    {error && <Alert severity="error">{error}</Alert>}
    {loading && !error && <Stack sx={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: `${tokens.spacing[2]}px`, bgcolor: "background.default" }}><CircularProgress size={tokens.spacing[8]} /><Typography variant="body2" sx={{ color: muted }}>正在加载第 {pageNumber} 页图片…</Typography></Stack>}
  </Box>;
}
