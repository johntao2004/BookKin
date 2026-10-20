import { useEffect, useRef, useState } from "react";
import { Dialog, DialogActions, DialogContent, DialogTitle } from "@/ui/overlays";
import { Box, Stack } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { Alert } from "@/ui/feedback";
import { tokens } from "../theme/generated-tokens";

export function coverCropRect(width: number, height: number, zoom: number, x: number, y: number) {
  const cropWidth = Math.min(width, height * 2 / 3) / zoom;
  const cropHeight = cropWidth * 3 / 2;
  return { width: cropWidth, height: cropHeight, x: (width - cropWidth) * x / 100, y: (height - cropHeight) * y / 100 };
}

type CropRect = { x: number; y: number; width: number; height: number };
type Corner = "nw" | "ne" | "sw" | "se";
const corners: { id: Corner; label: string; left: string; top: string }[] = [
  { id: "nw", label: "左上", left: "0%", top: "0%" },
  { id: "ne", label: "右上", left: "100%", top: "0%" },
  { id: "sw", label: "左下", left: "0%", top: "100%" },
  { id: "se", label: "右下", left: "100%", top: "100%" },
];
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function resizeCoverCrop(rect: CropRect, corner: Corner, dx: number, dy: number, imageWidth: number, imageHeight: number): CropRect {
  const right = corner.endsWith("e"), bottom = corner.startsWith("s");
  const anchorX = right ? rect.x : rect.x + rect.width;
  const anchorY = bottom ? rect.y : rect.y + rect.height;
  const maximum = Math.min(right ? imageWidth - anchorX : anchorX, (bottom ? imageHeight - anchorY : anchorY) * 2 / 3);
  // Project pointer movement onto the fixed 2:3 diagonal, keeping the opposite corner anchored.
  const delta = ((right ? dx : -dx) + (bottom ? dy : -dy) * 1.5) / 3.25;
  const width = clamp(rect.width + delta, Math.min(imageWidth, imageHeight * 2 / 3) / 10, maximum);
  const height = width * 1.5;
  return { x: right ? anchorX : anchorX - width, y: bottom ? anchorY : anchorY - height, width, height };
}

/** Keeps the source local until the user confirms the visible crop. */
export function useCoverCrop() {
  const [file, setFile] = useState<File | null>(null);
  const resolve = useRef<((blob: Blob | null) => void) | null>(null);
  useEffect(() => () => resolve.current?.(null), []);
  const finish = (blob: Blob | null) => { resolve.current?.(blob); resolve.current = null; setFile(null); };
  return {
    requestCrop: (next: File) => new Promise<Blob | null>((done) => { resolve.current?.(null); resolve.current = done; setFile(next); }),
    cropDialog: file ? <CoverCropDialog key={`${file.name}-${file.lastModified}`} file={file} onFinish={finish} /> : null,
  };
}

function CoverCropDialog({ file, onFinish }: { file: File; onFinish: (blob: Blob | null) => void }) {
  const [url, setUrl] = useState("");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [rect, setRect] = useState<CropRect | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const drag = useRef<{ x: number; y: number; rect: CropRect; corner?: Corner } | null>(null);
  useEffect(() => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024) { setError("请选择不超过 20 MB 的 JPEG、PNG 或 WebP 图片"); return; }
    const next = URL.createObjectURL(file); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  const startDrag = (event: React.PointerEvent<HTMLElement>, corner?: Corner) => {
    if (!rect || busy) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, rect, corner };
  };
  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    const start = drag.current;
    if (!start || !surface.current) return;
    const scale = surface.current.getBoundingClientRect().width / size.width;
    const dx = (event.clientX - start.x) / scale, dy = (event.clientY - start.y) / scale;
    setRect(start.corner ? resizeCoverCrop(start.rect, start.corner, dx, dy, size.width, size.height)
      : { ...start.rect, x: clamp(start.rect.x + dx, 0, size.width - start.rect.width), y: clamp(start.rect.y + dy, 0, size.height - start.rect.height) });
  };
  const keyboard = (event: React.KeyboardEvent<HTMLElement>, corner?: Corner) => {
    if (!rect || busy || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const step = Math.max(size.width, size.height) / (event.shiftKey ? 20 : 200);
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    setRect(corner ? resizeCoverCrop(rect, corner, dx, dy, size.width, size.height)
      : { ...rect, x: clamp(rect.x + dx, 0, size.width - rect.width), y: clamp(rect.y + dy, 0, size.height - rect.height) });
  };
  const confirm = async () => {
    if (!rect) return;
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const canvas = document.createElement("canvas"); canvas.width = 800; canvas.height = 1200;
        const context = canvas.getContext("2d"); if (!context) throw new Error("浏览器无法处理这张封面");
        context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, 800, 1200);
        const blob = await new Promise<Blob>((done, reject) => canvas.toBlob((value) => value ? done(value) : reject(new Error("封面转换失败")), "image/jpeg", 0.9));
        onFinish(blob);
      } finally { bitmap.close(); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "封面处理失败"); }
    finally { setBusy(false); }
  };
  return <Dialog open onClose={busy ? undefined : () => onFinish(null)} fullWidth maxWidth="sm">
    <DialogTitle>裁剪封面</DialogTitle>
    <DialogContent><Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {url && <Box ref={surface} sx={{ position: "relative", width: "fit-content", maxWidth: "100%", mx: "auto", touchAction: "none", userSelect: "none" }}>
        <Box component="img" src={url} alt="封面裁剪预览" draggable={false}
          onLoad={(event: React.SyntheticEvent<HTMLImageElement>) => { const image = event.currentTarget; setSize({ width: image.naturalWidth, height: image.naturalHeight }); setRect(coverCropRect(image.naturalWidth, image.naturalHeight, 1, 50, 50)); }}
          onError={() => setError("无法读取这张图片，请重新选择")}
          sx={{ display: "block", maxWidth: "100%", maxHeight: "50vh", width: "auto", height: "auto", pointerEvents: "none" }} />
        {rect && <>
          {[
            { left: 0, top: 0, width: "100%", height: `${rect.y / size.height * 100}%` },
            { left: 0, top: `${(rect.y + rect.height) / size.height * 100}%`, width: "100%", bottom: 0 },
            { left: 0, top: `${rect.y / size.height * 100}%`, width: `${rect.x / size.width * 100}%`, height: `${rect.height / size.height * 100}%` },
            { left: `${(rect.x + rect.width) / size.width * 100}%`, top: `${rect.y / size.height * 100}%`, right: 0, height: `${rect.height / size.height * 100}%` },
          ].map((mask, index) => <Box key={index} sx={{ ...mask, position: "absolute", bgcolor: "text.primary", opacity: 0.5, pointerEvents: "none" }} />)}
          <Box role="group" aria-label="2:3 封面裁剪框" tabIndex={0} onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => keyboard(event)}
            onPointerDown={(event: React.PointerEvent<HTMLElement>) => startDrag(event)} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
            sx={{ position: "absolute", left: `${rect.x / size.width * 100}%`, top: `${rect.y / size.height * 100}%`, width: `${rect.width / size.width * 100}%`, height: `${rect.height / size.height * 100}%`, outline: "2px solid", outlineColor: "primary.main", cursor: "move" }}>
            <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, 1fr)" }}>{Array.from({ length: 9 }, (_, index) => <Box key={index} sx={{ border: 1, borderColor: "divider" }} />)}</Box>
            {corners.map((corner) => <Box component="button" type="button" key={corner.id} aria-label={`调整裁剪框${corner.label}角`} disabled={busy}
              onPointerDown={(event: React.PointerEvent<HTMLElement>) => startDrag(event, corner.id)} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => keyboard(event, corner.id)}
              sx={{ position: "absolute", left: corner.left, top: corner.top, transform: "translate(-50%, -50%)", width: tokens.layout.touchTarget, height: tokens.layout.touchTarget, border: 0, padding: 0, bgcolor: "transparent", display: "grid", placeItems: "center", cursor: corner.id === "nw" || corner.id === "se" ? "nwse-resize" : "nesw-resize", touchAction: "none" }}>
              <Box sx={{ width: tokens.spacing[3], height: tokens.spacing[3], bgcolor: "primary.main", border: 1, borderColor: "background.paper", pointerEvents: "none" }} />
            </Box>)}
          </Box>
        </>}
      </Box>}
    </Stack></DialogContent>
    <DialogActions><Button disabled={busy} onClick={() => onFinish(null)}>取消裁剪</Button><Button disabled={busy || !rect || Boolean(error)} variant="contained" onClick={confirm}>{busy ? "正在处理…" : "确认裁剪"}</Button></DialogActions>
  </Dialog>;
}
