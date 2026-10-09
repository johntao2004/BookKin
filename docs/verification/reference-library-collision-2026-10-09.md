# BookKin walking clearance and collision revision

Revision: `20261009-walk-clearance-r4`.

This work starts from `e6663680260165c572a5f1ac1dd5720fc05e0436` and the separately
recoverable collision-engine checkpoint `a470bfbeacd29b4ce9de72cf2d565385466c766c`.
It does not restore the unavailable older local candidate, BVH implementation,
architectural picking-occlusion changes or unrelated initialization changes.
No remote push or deployment was performed.

## Defects reproduced and repaired

- The old 0.30 m eye-only clearance passed above gallery rails and upper desks at
  standing height. Walking now reserves 0.30 m laterally/above and 1.53 m below
  the 1.78 m eye. A 0.25 m foot allowance permits low step details; this is an
  upright conservative body envelope, not a gravity or full character simulator.
- A cylinder's separating/tangent contact was treated as an entering hit,
  introducing unwanted movement. Entering contacts now alone constrain motion.
- Cabinet collision previously covered only the 0.14 m back panel, allowing the
  camera to enter occupied shelf depth. Runtime cabinet cores cover the modeled
  0.74 m face-to-face extent without widening the aisle.
- The two full-height stair guard shells did not match the helical rail. Sixty
  local-height arc descriptors now follow the authored treads and preserve the
  final exit opening. Added doorway/arch/tracery shells follow their real holes.
- The stair exit had a raised stringer and incomplete foot support. The final
  stringer is flush, and guarded local infills support the exit footprint.
- The ground route ended under the first tread, causing an upward recovery when
  leaving guided motion. Both routes now begin/end at clear ground (±6.64, 0,
  -14.55).
- Upper passage width and full catalog rows needed clearance together. Upper
  cases span 11.10–14.58, with matching real-catalog anchors; no books were scaled
  or removed. The twenty-book/120-slot capacity is unchanged.

## Guided stair safety boundary

The authored route controls foot placement on tread and exit-infill support
surfaces. All guards/architecture still test the full body, and all solids still
test the eye. This exception applies only within 0.12 m of the current supported
route position, at its exact height, and for movement steps no larger than
0.12 m. Lateral departures, vertical flight, larger jumps and collision responses
leaving that corridor use the complete body against all solids. Ordinary free
movement never uses this support exception. Shift/Control flight, shelf movement
locking, real catalog identity and reader navigation remain in place.

## Evidence

The machine-readable [collision report](reference-library-collision-2026-10-09.json)
records the final configuration and CPU regression measurements. The separate
[exported-geometry report](reference-library-walk-clearance.json) measures actual
reimported GLB triangles; its modular proof matches the runtime exports.

- 1,132 authored descriptors; 1,192 expanded collision primitives
- Both stairs, up/down, including ±0.08 m route offsets: maximum sampled drift 0
- Both galleries, both directions, with ±0.45 m lateral offsets: drift 0
- 300 radial/segment-join checks on helical guards
- 160 large diagonal flight steps without a second depenetration drift
- Both faces of all 28 cabinet cores; all 12 upper desks; gallery/aperture/landing guards
- All 56 shelf views at desktop and portrait aspects, including near-plane corners
- Actual twenty-book binding span 3.269107 m; hit-target span 3.276 m; minimum
  conservative stile gaps approximately 15.0 mm and 12.0 mm respectively
- Exported geometry: fourteen passages at least 1.805 m wide, lowest measured
  tracery headroom 3.05 m, 84 book rows with positive clearance, supported stair
  exits/guards and five-centimeter minimum cornice-to-wall gaps

Dimensions are estimated scene units, not surveyed dimensions from the references.
The runtime retains 13 lossless modules, 28 shared materials and 11 unchanged
texture images; total runtime geometry is 1,554,611 triangles and module transfer
size is 43,714,932 bytes. Geometry counts are not frame-rate or GPU-memory results.

## Final automated verification

All checks ran against the integrated final source/model configuration:

- Frontend ESLint (`--max-warnings=0`): passed
- TypeScript project build/type check: passed
- Complete Vitest suite: **101 files, 383 tests passed**
- Production Vite/Sites build: passed
- Sites worker/package tests: **4 passed**
- Design-token freshness and `git diff --check`: passed
- Destination copy: all thirteen module byte counts and SHA-256 hashes match the
  final manifest; original texture files are byte-for-byte unchanged

The tools were invoked through the installed package scripts/binaries (npm
scripts are the same lint/typecheck/build/test commands as the pnpm workspace).
The lockfile was not changed. Two dependency install scripts were not approved or
run; they were not needed for these checks. jsdom emitted existing unsupported
canvas/computed-style/CSS warnings, and Vite retained its large-Three.js-chunk
warning; neither is GPU/browser verification.

## Verification limits

The available cloud Chromium reported WebGL unavailable. No security/GPU policy
was bypassed and no actual browser 3D walking or FPS acceptance is claimed.
Offline Blender renders and CPU tests are separate evidence. A supported browser
still needs an interactive pass for visual motion, picking and GPU performance.
Backend code was unchanged; backend Maven verification was not run for this patch.
