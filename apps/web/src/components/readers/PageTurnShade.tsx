import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";

export function PageTurnShade() {
  return (
    <>
      <Box
        component="canvas"
        aria-hidden
        data-page-turn-overlay
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          display: "block",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          opacity: 0,
          willChange: "opacity",
        }}
      />
      <Box
        aria-hidden
        data-page-turn-shade
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          opacity: 0,
          background: (theme) => `linear-gradient(90deg,
            transparent 24%,
            ${alpha(theme.palette.text.primary, 0.04)} 38%,
            ${alpha(theme.palette.text.primary, 0.22)} 48%,
            ${alpha(theme.palette.background.paper, 0.82)} 51%,
            ${alpha(theme.palette.text.primary, 0.12)} 58%,
            transparent 76%)`,
          backgroundSize: "240% 100%",
          willChange: "opacity, transform, background-position",
        }}
      />
    </>
  );
}
