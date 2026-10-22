import { useState } from "react";
import type { ImgHTMLAttributes } from "react";
import { Box, Typography } from "@/ui/primitives";
import type { SxObject } from "@/ui/primitives";
import { MenuBookRounded } from "@/ui/icons";
import { tokens } from "../theme/generated-tokens";

export const BOOK_COVER_ASPECT_RATIO = "3 / 4";

/** All book surfaces share a filled portrait frame, independent of source size or ratio. */
export function BookCover({ src, alt, title, sx, imageSx, loading = "lazy", fetchPriority }: {
  src?: string;
  alt: string;
  title?: string;
  sx?: SxObject;
  imageSx?: SxObject;
  loading?: ImgHTMLAttributes<HTMLImageElement>["loading"];
  fetchPriority?: ImgHTMLAttributes<HTMLImageElement>["fetchPriority"];
}) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return <Box data-book-cover="" sx={{ width: "100%", minWidth: 0, flexShrink: 0, ...sx,
    aspectRatio: BOOK_COVER_ASPECT_RATIO, position: "relative", overflow: "hidden",
    borderRadius: `${tokens.radius.lg}px`, boxShadow: tokens.shadow.cover, bgcolor: "background.paper", display: "flex",
    alignItems: "center", justifyContent: "center",
  }}>
    {src && failedSrc !== src ? <Box component="img" src={src} alt={alt} loading={loading} decoding="async" fetchPriority={fetchPriority}
      onError={() => setFailedSrc(src)}
      sx={{ ...imageSx, position: "absolute", inset: 0,
        display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "center",
      }} /> : <Box sx={{ width: "100%", height: "100%", bgcolor: "background.paper", border: 1, borderColor: "divider",
        position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: `${tokens.spacing[2]}px`, overflow: "hidden", p: `${tokens.spacing[1]}px`,
      }}><MenuBookRounded />{title && <Typography sx={{ textAlign: "center", overflowWrap: "anywhere" }}>{title}</Typography>}</Box>}
  </Box>;
}
