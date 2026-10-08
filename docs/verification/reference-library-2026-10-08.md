# High-detail modular library integration

Revision: `20261008-reference-modules-r3`. This supersedes the monolithic
round-three integration and all round-one/round-two delivery snapshots.
Remote baseline: `3c3e998f3a09400fd2605840e9eefd3df6917efd`.

## Scope and fidelity

The existing authenticated `/virtual-library` route, catalog API, real book IDs,
Thema categories, book inspection and EPUB/PDF readers are preserved. The approved
model is divided into 13 bounded modules; this is not a lower-detail procedural
replacement. No server, login-policy, CI or deployment configuration is changed.
The sole added package is a pinned offline encoder (`meshoptimizer@1.1.1`);
Three.js already includes the runtime decoder.

Source GLB: 91,057,412 bytes, SHA-256
`0cc0db68263287c3bd3f6f30c8f7a58e4c32da8e279912674d5219323ee87a75`.
The raw source and Blender file remain authoring inputs, not web payloads.
Reproducible scripts and the original generated portrait input are retained.

Independent verification compared the complete multiset of all 1,552,983
triangles, including ordered raw POSITION/NORMAL/UV float32 corner bytes and
material IDs. Nothing was removed, duplicated, rotated or quantized. All 11 PNG
images and material/texture/sampler definitions are unchanged. Canonical triangle
multiset SHA-256:
`27a85b43ea25048a8781d1674e7e206818a3a9ade17b3c86bc3176ffc60a18ed`.
See `reference-library-exact-preservation.json` and the reproducible
`node scripts/hogwarts-library/verify_modules.mjs SOURCE.glb` verifier.

## Transfer and residency

- All geometry modules: 43,684,648 bytes; largest file: 9,315,084 bytes
- Shared image files: 6,410,857 bytes; complete geometry+image payload: 50,095,505 bytes
- Configured eight-module startup: 22,928,288 geometry bytes + shared images,
  before small JSON/config overhead and catalog/readiness-dependent additions
- Decoded input geometry: 80,499,590 bytes; all 1,552,983 triangles retained
- 367 collision descriptors, 28 double-faced cases, 56 selectable faces,
  6,720 catalog slots; dimensions 30 × 36, gallery 6.2, crown 18.7

The decoder uses KHR Meshopt bitstream v1, no filters, exact index sequences and
Uint16 indices only where their values fit. Geometry crossing region boundaries
stays whole; long structural triangles belong to the continuous core.
See `reference-library-modules.json` and `reference-library-transfer-budget.json`.

Shared PNG payload is not the same as GPU storage. RGBA8 plus mipmaps is estimated
at roughly 47.53 MB; observed GPU memory remains unmeasured. The directional shadow
camera covers almost the entire hall, so all 13 modules normally become resident.
This design does not claim that default-view total residency is small.

## Rendering and lifecycle

Native multi-draw uses scene-owned canonical final material variants and bounded,
progressively growing material batches. Unsupported browsers first stream the
same modules, then consolidate fully resident geometry during yielded work.
The fallback is intentionally all-resident after consolidation: it does not claim
per-module culling or eviction. Both retain 28 architecture material submissions
per pass in CPU-side loader/batcher verification, excluding catalog/UI geometry.

At the exact default entry camera, independent CPU frustum inspection estimated
1,533,311 native-path architecture triangles versus 1,552,983 after fallback
consolidation. This is not a large triangle-count reduction. The substantial
steady-state rendering change is cached static shadows rather than recomputing
the entire shadow pass on every camera-only frame. Geometry/light changes and
catalog/inspection transitions invalidate that cache.

Real-asset CPU probes found final batched geometry capacity about 85.10 MB,
temporary native allocation peaks around 111–113 MB, and fallback copy peak about
106.79 MB. Progressive material-copy timings varied with cloud load (roughly
21–167 ms maximum observed in separate runs); no hard 50 ms or browser-responsiveness
claim is made. Fallback consolidation performs roughly 242 ms total CPU work
across yielded material groups. Actual browser/GPU timing must be measured.

The controller limits concurrent loads to two; shares final materials and images;
retries failed promises; keeps collision and book anchors stable; waits for target
regions; prevents floating/clickable books on unloaded shelves; pins visible,
focused and shadow-required geometry; and cancels/detaches on route exit before
releasing shared resources. ImageBitmap fetches are independently abortable from
the catalog manager. Tests cover late completion, reload, teardown and ownership.
The previous global optimizer is bypassed for controller-owned architecture.

## Verification status and boundaries

The final machine-readable test results are in `reference-library-final-results.json`.
Do not count the earlier 342-assertion run as a clean pass: it exposed two existing
Ant Design delayed validation callbacks after registration-test teardown. A
narrow test-only wait now observes feedback clearing before that test ends;
registration product behavior and assertions are unchanged.

Backend verification is not run for this frontend-only change. Existing jsdom
CSS/canvas warnings and Vite's large-chunk notice are reported separately.
CPU geometry tests use mocked browser image creation; they do not establish
material/lighting equivalence on a GPU. The earlier supported cloud-browser
localhost request returned `net::ERR_BLOCKED_BY_CLIENT`; no bypass was attempted.
Browser visual/interaction acceptance, mobile performance, load duration and FPS
remain unverified. The existing approximately 30 FPS application throttle remains
in place and is exposed in diagnostics.

The unchanged Docker workflow builds on main pushes/PRs; image publication occurs
only for `v*` tags. This change creates no tag or new deployment configuration.

A separate catalog-only CPU probe used repository demo data and synthetic fixtures,
not private user records. Four books added 13,240 triangles and 24 potential draws;
120 books added 397,200 triangles and 720 potential draws. The shelf/plaque layer
added about 64 entry-view draws in that probe. See
`reference-library-catalog-budget.json`. This existing catalog cost is excluded
from the 28 architectural-batch figure and remains a large-library limitation.
