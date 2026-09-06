# Collegiate Gothic virtual library — 2026-09-06

> This is a dated iteration log. Earlier tables, trusses and computer screenshots are superseded. The current implementation is summarized in [docs/virtual-library.md](../../../docs/virtual-library.md); current release checks are in [implementation status](../../../docs/implementation-status.md).

## Reference and interpretation

The Bodleian Libraries confirm that Duke Humfrey's Library was used as the Hogwarts library in the films:
https://visit.bodleian.ox.ac.uk/venue-hire/filming-photography

Film reference inspected in the browser:
https://allureprojects.com/app/uploads/sites/28/2022/11/Harry-potter2-library-1831877064.jpg

Observed features: dark timber bookcases, deeply recessed joinery, lancet windows with leadwork, warm table lamps and shared reading furniture. The implementation is an original collegiate Gothic interpretation within BookKin's existing circular circulation plan, not a literal reproduction of the film location. Reference images are not shipped as application textures.

## Reconstruction

- Replace the painted conical canopy with a closed curved oak lining, sixteen moulded principal ribs, paired tiercerons, cross ribs and carved rosette bosses.
- Three pointed timber trusses establish a longitudinal rhythm across the hall, with hammerbeams, curved brackets and small vertical members.
- Two long reading tables, twelve turned chairs, six lamps, leather writing mats and parchment stationery. Model-anchored collision shells protect the tables, chairs and trusses.
- Fluted wall columns and moulded collars retain the original shared column radii and symmetric feature locations.
- Shared wood bump maps, softer lamp emissive output and indirect vault illumination reveal geometry without masking it in bloom.
- Repeated ceiling arches carry the same timber construction into both independent rooms. The office's background spines use aged brown, burgundy and green rather than bright white.
- Retain geometry batching and lazy room creation; remove the unused old ceiling panel texture generation.

## Browser evidence

Local runtime: http://localhost:4173/virtual-library
Actual viewport: 1280 × 720. The browser viewport override requested for 390 × 844 did not take effect (innerWidth remained 1280); mobile visual acceptance is therefore not claimed.

Verified: hall rendering, drag orbit, shelf focus, book pull-out, drag rotation, wheel scaling, short-click entry into the actual EPUB reader, director room entry/return, restricted room entry/return, and no document horizontal overflow at the actual viewport.

The scene reports four real book models. Inspection reports four total, three shelved, one inspected. New hall collider count is 340. The scene model marker is `collegiate-gothic-vault-reading-hall-2026-09-06`.

Screenshots: `hall.jpg`, `director.jpg`, `restricted.jpg`.

The console includes an existing shared-shell Ant Design Drawer width deprecation. No new WebGL error was observed after the scene correction. Automated checks are recorded below when completed.

## Automated validation

Final-code `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed. Vite retains its bundle-size warning.

A single-worker rerun of all virtual-library tests plus App, BooklistsPage and DisplayBooksSettingsPage passed: **8 files, 63 tests**. This includes collision continuity after static batching, a clear reading aisle, closed finite vault geometry, and a bounded geometry/draw-call budget.

The earlier parallel full-suite attempt encountered two page-test timeouts and a worker-start timeout on this loaded machine; the failed page cases and skipped interaction suite passed in the single-worker rerun. A final full-suite single-worker result follows.

**Final full-suite result:** `pnpm test --maxWorkers=1` passed **45 test files / 181 tests** in 130.60 seconds. All final-code lint, typecheck, tests and build checks passed. No backend or production deployment change was made.

## Follow-up correction: clear floor and catalog terminal

The user rejected the two central reading tables and the low transverse beams. Both table/chair assemblies (including their lamps, mats, carpet and colliders) and the three low hammerbeam assemblies have now been removed. The remaining hall vault has a tested minimum height above the upper bookcase crowns. Independent-room ceiling ribs have been raised above their bookcases as well.

A modeled monitor, stand and keyboard now sit on the existing reception countertop. Clicking the computer opens an Ant Design catalog-search dialog; keyboard users can reach the same action through focus navigation. Search filters the already-authorized private catalog by title, author, series, format and tags. Results link to the real reader; no duplicate catalog data or external service is introduced. A stationary press/release is required; foreground hall geometry blocks clicks through it. Escape closes the dialog without changing the underlying shelf or room.

Browser checks: physical screen click, live author search, no-result state, title search, result navigation into the actual EPUB reader, clear central floor, side-angle hall inspection, and room ceiling clearance.

The earlier `hall.jpg` shows the superseded table layout. The current view is `catalog-terminal.jpg`.

Follow-up validation: lint and typecheck passed; full single-worker suite passed **46 files / 183 tests**; production build passed. Existing Ant Design Drawer deprecation and Vite bundle-size warnings remain.

## Chandelier suspension correction

Replaced the fixed-length chandelier chain with a suspension calculated from the actual ceiling height and fixture scale. The hall chain now reaches the curved vault at Y=18.64; both independent-room fixtures reach the ceiling underside at Y=6.25. Added physical ceiling mounting plates. Regression coverage checks every consecutive chain-link bounding interval, the bottom collar, top shackle, and the final scaled ceiling contact for all three fixtures.

## Current correction: button icons, celestial catalog and hearth fire

The latest reception model is an original celestial catalog orb: a turned brass pedestal, midnight-blue globe, inlaid constellation, meridian hoops and a physical catalog plaque. It replaces the monitor and keyboard, sits on the existing counter, and retains private-catalog interaction and a camera collision shell.

Search opens as one focused input centered in the viewport. Its empty state contains only the input; typing reveals live matches and reader links. Browser measurements at 1169 × 886 found zero horizontal or vertical center offset. Physical orb click, author/title lookup, no matches, result-to-EPUB navigation and Escape closure were verified.

Shared Button now gives Ant Design independent icon and text slots, including trailing icons and router links, instead of a Fragment wrapped inside one text span. Icons use the body-size token and the gap uses the existing spacing token. Two-character Chinese labels retain their original text without inserted spaces. Browser inspection covered the catalog, booklists, user management, reader navigation and virtual-library controls; visible library buttons had 16 × 16 icons, 8px gaps and zero vertical center offset. Create-dialog opening/cancellation also worked.

The fireplace uses one bounded ray-marched fire volume with upward turbulence, glowing coals and staggered logs. It has no camera-facing sprites or flat circular glow. Its complete flame volume stays inside the opening and behind the grate; coal placement derives from geometry bounds at the hearth surface. Front and oblique orbit checks confirmed masonry/grate occlusion. No new WebGL shader error was observed; the pre-existing Ant Design Drawer width warning remains.

Current screenshots: `orb-fire-front.jpg`, `orb-fire-oblique.jpg`, `orb-centered-search.jpg`. Earlier computer screenshots are superseded.

Final validation: `pnpm lint`, `pnpm typecheck`, `pnpm test --maxWorkers=1` and `pnpm build` all passed. Full suite: **48 files / 188 tests**. This includes icon-slot separation, unchanged Chinese labels, link/disabled/click behavior, live search, fire containment, exact coal contact and animation after batching. Vite retains its existing bundle-size warning. Local preview only; no backend or deployment change.
