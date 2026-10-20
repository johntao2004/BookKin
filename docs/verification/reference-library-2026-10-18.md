# Virtual library r6 verification

Historical r6 acceptance. Superseded by the A-end art-gallery r7 revision;
current generated JSON reports refer to r7. See `reference-library-2026-10-19.md`.

Revision: `20261018-crosswalk-stair-walk-r6`.

The previous r5 checks covered guided stair buttons and wall overlap. They did
not establish that ordinary WASD walking could climb stairs, or that both end
crosswalks had sufficient width. This revision corrects those acceptance gaps.

## Changes

Both end walls move outward by 2 m, from nominal z=±18 to ±20. The hall envelope
is 30×40; the six central bays, shelf addresses, stair anchors, and catalog
allocation stay fixed. Crosswalk floors span z=±15.6…±20, joining both side
galleries. B-end gallery pilasters move to z=19 while the projecting balcony
keeps its original position and all guards/support collisions. The pale A-end
ledge sculptures stay at their original atrium-facing position, so their bodies
are not buried in the extended walking floor.

Measured physical clear widths are 3.10 m at A and 2.80 m at B. Accounting for a
0.30 m body radius on each side leaves continuous common walking bands of 2.50 m
and 2.20 m across x=-10.1…10.1. These are collider-based geometry measurements in
estimated model units, not a survey. Actual exported floor, roof and end-wall
surfaces are checked separately; 590 floor samples have no holes.

Ordinary keyboard, wheel and forward/back button walking now follows local
stair support height in short swept steps. Position and foot-height gating keep
overlapping spiral turns separate. Full body collision against pillars and
rails, plus head collision against every solid, remain active. Vertical flight
continues to use every collision surface. The local support exception only
applies to stair treads and exit infill, and does not start a guided animation.

The r5 shelf-front furniture removal and end-wall overlap corrections remain:
all six lower lecterns and twelve upper desk/chair/lamp sets are absent, with no
orphan collision shells. The three central long tables and six benches remain.

## Source and runtime verification

- Editable Blender source and all thirteen runtime modules regenerated.
- Source SHA-256: `d2deeb89b10b8ef68d0312c5432649aa7791b8da6ef35c28dd3a32346bae9acb`.
- 1,511,807 exported triangles, with exact ordered triangle-attribute multiset
  preservation across runtime modules.
- All 28 material definitions, 11 images, textures and samplers match r5 and the
  approved baseline. Image bytes were compared directly.
- Both end walls, floor continuity and former furniture footprints checked.
- Fourteen upper door openings, 84 shelf-row samples, supported stair exits,
  route head clearance and guard support checked against the exported GLB.
- 1,104 model descriptors expand to 1,164 runtime collision shells.

Current JSON reports in this directory record source geometry, module hashes,
triangle preservation, walk clearance and crosswalk measurements.

## Application and browser validation

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` passed: 103 test files,
397 tests. Tests include full-body traversal of both end crosswalks in both
directions with ±0.95 m lane offsets; four complete unguided stair centerlines;
±0.05 m stair lanes; alternating cardinal steps; the reported top-landing stuck
position; guard/pillar collision, flight and floor-height separation.

The authenticated browser loaded r6 with 124 real catalog books and no failed
modules. Ordinary keyboard input, without stair buttons or Shift/Ctrl, traversed
both complete stairs upward and downward. Heights changed from 1.78 m to 7.98 m
and back. Both end crosswalks and both side galleries were traversed continuously
at gallery height. Keyboard steering around the spiral and into the landing is
required; this is not a claim that walking directly into a rail should pass.
Browser console had no errors during these checks.

The final sculpture-position correction changes rendered geometry only; its
new floor-intersection probe, exact geometry verification, affected frontend
regressions (6 files, 56 tests) and refreshed build passed after the full suite.
Local screenshots and keyboard diagnostic traces are in
`.artifacts/model-clearance/`. No backend source changed. No commit, push or
production deployment was performed.

## Remaining issue

Picking can select a shelf behind foreground gates or columns because the
current hit test omits architectural occlusion. This revision does not fix that
separate interaction issue or claim exhaustive coverage of the whole library.
