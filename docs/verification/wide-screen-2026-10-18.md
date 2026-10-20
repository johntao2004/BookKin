# Ordinary-page wide-screen layout verification

Updated 2026-10-19. Base: main `1889bcefcfccd0b7e73a36b8384c9dce8a3c5d65`, fast-forwarded from the old checkout. Changes remain uncommitted.

## Current behavior

The complete ordinary UI enlarges gently beyond 1920 CSS pixels: scale = 1 + max(0, viewport width - 1920) / 7680. Navigation, typography, controls, cards and body portals share the scale. This gives 125% at 4K and about 142% at 5K. Browser/OS scaling is already reflected in the CSS viewport. Reader and immersive 3D routes are excluded; effect cleanup removes root zoom and viewport variables on exit. Fixed custom menus convert displayed coordinates into logical CSS coordinates, and dialog bounds use scaled viewport dimensions.

Catalog grids share a 224px logical minimum at the 1920px breakpoint. Sparse results preserve empty tracks; loading grids share the same contract. Booklist hero covers are capped at 288 logical pixels. The overview uses four equal 336px logical-height cards from the 1440 CSS-pixel desktop breakpoint; tablets retain two columns and phones one. Its featured cover column is capped at 40% of inner width and 160px. Notes use a 448px logical minimum. Settings keep a full-width outer frame and cap inner content at 1520 logical pixels; mail/font-upload forms are capped at 760 logical pixels.

## Checks

- Frontend lint, typecheck, all 102 test files / 386 tests, and production build passed after the final scale and overlay changes.
- The targeted scale/menu/shell set passed 3 files / 12 tests, including resize, disabled-surface cleanup and portalled-menu positioning.
- `pnpm check:tokens` and `git diff --check` passed.
- Live read-only Figma check: five collections / 75 variables; no layout/width/breakpoint/reading/scale variables. Remote variables were not changed.

## Browser evidence

Authenticated local preview: http://127.0.0.1:4176/library/all .

| CSS viewport | Root scale | Navigation height | Catalog |
|---|---|---|---|
| 3840x2160 | 1.25 | 80px | 11 columns, about 306px displayed card width |
| 5120x2880 | 1.41667 | 90.66px | 14 columns, about 318px displayed card width |
| 1440x1000 | 1 | 64px | Existing desktop layout |
| 390x844 | 1 | Existing mobile navigation | Mobile drawer opens and closes |

All sampled viewports had zero positive horizontal page overflow. At 4K the account menu aligned with its trigger; actual book details opened and closed in a centered 950px-wide dialog within the 2160px viewport. The custom book action menu opened at the correct card location and dismissed with Escape. Settings root status and the categories empty state rendered successfully. Populated category/booklist/annotation flows and reader/3D scenes were not browser-tested in this pass.

Console entries were request-cancellation AbortErrors from React Query observer unmounts during route transitions; no layout exception or page crash was observed. Existing test-environment canvas/CSS warnings and production bundle-size warnings remain. Screenshots are ignored local evidence under `.artifacts/wide-screen/*-scaled.png`. Viewport override was reset and the library preview retained.

No backend changes, commit, push or deployment. The separate model worktree is still processing newer art-wall/stair work; its evolving assets have not been mixed into this ordinary-page patch.

## 2026-10-19 overview refinement

Lowered the single-row overview threshold from 1920 to 1440 CSS pixels to cover high-DPI desktop viewports. Browser measurements: 1897px yields four 440.5px cards on one row; 1440px yields four 326.25px cards on one row; 1024px yields two columns; 390px yields one column. All sampled views had zero horizontal overflow and no featured heading/action escaping its card. Frontend lint, typecheck, 10 LibraryPage tests, production build and diff whitespace checks passed after this refinement. No new token values or backend changes. Screenshot: `.artifacts/wide-screen/overview-single-row.png`.
