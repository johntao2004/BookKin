# Window-side passages on both floors, r15

Revision: `20261019-outer-aisles-r15`. Supersedes r14 for the live model.

Expanded the building from 30×40 to 34.8×40 model units, moving each outer
stone/window assembly outward by 2.4. Both gallery floors, ground pavers,
end walls and side barrel roofs extend with it. Small transverse roof seams
formerly hidden behind the cases are now closed above the outer passages.
The 28 double-faced cases, catalog anchors, book dimensions, inner aisles,
stair anchors and the +20% story elevations retain their existing dimensions.

Final source SHA-256:
`561a319c1a6b963b38729b3b75ae7eff0f27f10fa8fc72399aced8c470077eb4`.
Config SHA-256:
`49892f9e596c2e938add2f46875b50477eb2abb5db5b90f3c61a6f9bfe0ee0b1`.
1,335,213 exported triangles, 28 materials, 12 images and 13 runtime modules.

Source geometry, Blender walking clearance, end walls, end crosswalks,
arcade soffits, rigid-feature preservation and exact modular triangle/texture
preservation checks pass on the final source hash. Frontend lint, typecheck,
405 tests across 104 files and production build pass. The build was repeated
after the final roof seam patch; the patch did not change the collision config
or frontend logic. A dedicated runtime test walks all four outer passages in
both directions on three lateral lanes, joins both end crosswalks and checks
that the outer walls still block outward movement.

Authenticated browser verification: r15 reaches `ready`, 13 resident modules,
0 failed modules, 125 real catalog books. The lead walked the left lower aisle
from (-16.179, 1.780, 18.102) through z=1.557 to z=-16.966, and the left upper
aisle from (-16.143, 9.220, -18.398) through z=-1.557 to z=16.904, all clear.
The lower walk preceded the final roof-only seam patch; the upper walk uses
the final export. Browser console error list is empty. The right passages
are covered by geometry and full-body runtime tests rather than a manual
browser traversal in this round.

Evidence: `.artifacts/model-clearance/outer-aisle-ground-r15.png`,
`outer-aisle-upper-r15.png` and `runtime-outer-aisles-r15.json`.
The outer-aisle report additionally confirms an uninterrupted 2.0 m-wide
physical band over the full standing height on all four passages, zero mesh
or collider blockers, 876 floor footprint samples and 390 roof samples
(including every transverse seam). Cross-section widths at y=floor+1.0 are
2.815 m on the lower floor and 2.635 m on the upper floor. These are model
units, not measured real-world building dimensions.

No commit, push or deployment was performed.

---

# Open ground arcades, r14

Revision: `20261019-open-arcades-r14`. Supersedes r13 for the live model.

Removed the four ground-floor iron gates together with their four collision
shells, so the ground arcade is continuously open at body height. The stair
handrails and the upper gallery safety guards are retained unchanged, as are
the r13 statue-free niches, paintings, enlarged landings and 20% taller
stories.

Final source SHA-256:
`6c3979cd7b12c649c57a05de09cba4c5fd61054a9dbaf0bb85e50dc67a78afd1`.
Config SHA-256:
`527f3e52a904492c0d8ce8b554efcd38113cc032bf959feb8e484685a057ab75`.
1,246,377 actual exported triangles, 28 materials, 12 images, 13 modules,
1,112 source collision descriptors and 1,188 resolved architecture colliders.

Verification on this source hash with the Blender 4.3 bundled Python:
`verify_end_walls.py`, `verify_crosswalk.py` and
`verify_arcade_soffits.py --json docs/verification/reference-library-arcade-soffits.json`
all report `passed: true` with empty `failures`. The three refreshed reports
`reference-library-end-walls.json`, `reference-library-crosswalk.json` and
`reference-library-arcade-soffits.json` all bind the source SHA-256 above and
revision `20261019-open-arcades-r14`; the end-walls and crosswalk reports also
bind the config SHA-256, while the arcade-soffits report carries no config hash
field. End-wall art and
balcony colliders, the 2.0 m body-clear crosswalk band over `x=-10.1…10.1`
and all twelve aligned arcade soffits still hold after the gate removal.

Frontend lint, typecheck, 404 tests across 104 files and the production build
pass.

Authenticated browser check (run by the project lead) reaches phase `ready`
with revision `20261019-open-arcades-r14`, 13 resident modules, 0 failed
modules, 125 catalog books and 1,188 colliders. A walk from
`(-6.848, 1.780, 8.148)` across the former left gate plane at `x=-8.76` to
`(-10.873, 1.780, 8.148)` reports `collision: clear` with no console errors.
Evidence: `.artifacts/model-clearance/runtime-open-arcades-r14.json` and
`open-arcades-walk-r14.png`. This covers that single gate crossing only; the
stair routes were not manually walked in the browser in this round.

This verification subtask only refreshed documentation and reports; the r14
generator and assets were rebuilt separately by the project lead. No commit,
push or deployment was performed.

---

# Small gallery statue removal, r13

Revision: `20261019-no-scholars-r13`. Supersedes r12 for the live model.

Removed all 14 remaining small scholars: 12 side-wall figures and two A-end
inner figures. Their timber niches and plinths are removed at generation time;
12 former `lower-pier-niche` collision descriptors are also removed. The pale
scholar material is absent from the actual source GLB and all 13 runtime modules.
Structural piers, guards, exhibition paintings, enlarged landings, 20% taller
stories and catalog shelf dimensions remain intact.

Final source SHA-256:
`aecb78f6d1f6b2e3e1aeedc68bffe6159ac6c22a979104902eb84241e400c6b4`.
Config SHA-256:
`116b372f324113cdf64c778ff67caa329a27fcf8746dba2d141f0e7bb636d90e`.
1,267,737 actual exported triangles, 29 materials, 12 images, 13 modules,
1,116 source collision descriptors and 1,192 resolved architecture colliders.
Exact triangle attributes and image bytes are preserved across the modular export.

Source geometry, walk clearance, end walls, crosswalk, arcade soffits and
retained rigid-feature comparisons all pass on this source hash. The rigid
comparison now requires scholar geometry to be absent while preserving actual
globe, furniture and painting coordinates. Blender rays still verify 14 doorways,
336 shelf faces, 12 windows and both stair routes.

Authenticated browser QA loads r13 with all 13 modules, no failed modules, 125
catalog books and 1,192 colliders. Hall and upper A-end views confirm cleared
statue sites, retained structure and paintings. Evidence:
`.artifacts/model-clearance/no-scholars-hall-r13.png`,
`no-scholars-gallery-r13.png`, `runtime-no-scholars-r13.json`.

Browser smoke checks pass for guided left-stair ascent/descent, fiction shelf
focus, selection of a real catalog book and two-step Escape restoration. No
browser console errors were captured. Lint, typecheck and production build pass;
the full suite initially passed 400 of 403 tests. The three failures in the
unrelated category/cover-upload suites passed when both files were rerun
alone (9/9 tests), with no source changes to those pages.
No backend changes, commit, push or deployment were performed.

---

# Taller stories and continuous arcade soffits, r12

Revision: `20261019-taller-stories-r12`. Supersedes all historical source hashes below.
Source SHA-256: `9ce670704e40f56bfed7222d10b1b962e391f42bbf1b7345683e662276e8aba8`.
Config SHA-256: `89d915fb040724d40edc1bc2e350dc2897c1b2b6519c47091b1ea16365ef5382`.

Both architectural stories gain 20% height. Gallery elevation: 6.2 → 7.44;
central vault spring/crown: 13.8/18.7 → 16.56/22.44. Window profiles,
shelf heights/bases/pitches, floor shells, roof envelope and collisions follow
these elevations. Cabinet depth .78, book depth .288/height .48, human eye 1.78
and body radius .30 remain unchanged. Both stairs have 40 treads, .186 risers,
the original .95 turn/footprint and enlarged 3.05×2.4 resting zones.
Gallery guardrails, paintings, scholars and chandelier bodies translate at
their mounting anchors without stretching. Ground furniture/globe retain their
coordinates. Main suspension collision begins at the translated body top and
continues to the raised roof; body collision covers the lower cable.

All twelve ground arcade painted intrados, timber rings and spandrels share
64 aligned nested elliptical profiles. This fixes the timber wedges that cut
through the blue soffit near the crown. Final exported GLB rays: 2,700 primary
and 96 oblique hits; every first hit is blue paint or ivory ornament, zero wood.
The r10 baseline fails independently with 684 first-hit timber rays.

Verified final artifacts:

- 1,532,965 actual exported triangles, 13 runtime modules, 30 materials and 12
  image streams. Complete ordered triangle-attribute multiset and image-byte
  preservation between the source GLB and runtime modules pass.
- 14 doorways, 336 shelf-row faces / 2,016 book-footprint supports, 12 windows,
  both landings, guards and stair-route head clearance pass actual GLB ray probes.
  Minimum upper doorway headroom is 3.66 above the 7.44 floor. End A/B retain
  clear crosswalk bands of 2.70/2.20. Source descriptors: 1,128; runtime: 1,204.
- `verify_rigid_features.py` compares actual r10/final GLB spatial samples for
  globe surfaces, desk surfaces/lamps, all pale scholars, four gallery paintings
  and the central portrait: unchanged local dimensions within 0.00001.
- Frontend final `pnpm lint && pnpm typecheck && pnpm test && pnpm build`: pass,
  104 test files / 402 tests. The first run exposed an ambiguous generic alert
  selector in the catalog retry test when WebGL fallback also raised an alert.
  The test now selects the specific catalog error text; no timeout or application
  behavior was relaxed. The final full run passes. Existing jsdom canvas/CSS
  diagnostics and the large-chunk build advisory remain non-fatal.

Reports: `reference-library-source-geometry.json`, `reference-library-modules.json`,
`reference-library-exact-preservation.json`, `reference-library-walk-clearance.json`,
`reference-library-end-walls.json`, `reference-library-crosswalk.json`,
`reference-library-arcade-soffits.json`, `reference-library-rigid-features.json`.

Authenticated browser QA on the final local route loaded revision r12,
all 13 modules, 124 real books and 1,204 colliders with zero failed modules.
Both left/right guided stair buttons completed up/down trips between eye
heights 1.78 and 9.22. Manual keyboard movement on the right upper flight
changed eye Y 9.220 → 9.092 → 8.662, then 8.937 → 9.220 on return.
This is a sampled manual stair check, not a full keyboard traversal of both
spirals. Close front/reverse oblique screenshots confirm the continuous painted
soffit without timber wedges. Novel section focus, real-book selection
(`潮汐档案 011`) and two Esc returns restored the free camera position and
movement controls. Final browser console errors: none. No reading progress was
created; the reader was not opened. Preview/API returned HTTP 200 / health UP.
Evidence: `.artifacts/model-clearance/taller-gallery-r12.png`,
`continuous-soffit-r12.png`, `continuous-soffit-reverse-r12.png`,
`runtime-taller-stories-r12.json`.

Worktree-only changes; no commit, push or deployment. Backend/database unchanged.
These are estimated model units, not surveyed dimensions.

---

# Book-fit shelf depth, r10

Revision: `20261019-book-fit-shelves-r10`. Supersedes source hashes below.

All 28 double-sided real-catalog cabinets (56 faces) now have .78-deep boards,
up from .65. Each face has .33 usable depth outside the shared .12 back panel;
rendered books retain their .288 depth, .48 height and existing spine scale.
The book rear clears the back panel by .024; its front is inset .018 from the
board edge, supported above the bevel. Centers move .02 outward on each face.
Stiles, full-depth side fluting, plinths, cornices, plaques and solid camera
bounds are synchronized. The upper dado trim moves down .03 to clear the
lowest book plane. These are estimated model units.

Final source SHA-256: `a53569ec865dca1af047b298dd7b85853baf59fc47af7eb71bf08afae8e272eb`.
1,506,413 architectural triangles, 13 runtime modules, 30 materials, 12 unchanged
image streams. Exact ordered triangle attributes and complete multiset proof
pass. Window, art-gallery, stair routes and floor layout contracts remain r9.
Only the shelf contract and cabinet stile collision depths change.

Final exported geometry probes cover all 336 shelf faces by row on both floors:
six support points per face under the real-book footprint, physical front edges
and back faces. All pass. Doorways, shelf width margins, stair headroom, landing
support, end walls, crosswalks and all twelve windows pass on the final hash.

`pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass (104 files,
401 tests). The independent DeepSeek regression was reviewed and integrated;
it checks runtime/generated depth consistency and transformed book bounds on
all 56 sections/six rows. The existing build chunk-size advisory remains.

Authenticated browser acceptance passes on the final r10 revision: all 13
modules resident, zero failures, 1,506,413 architectural triangles, 1,156
collision shells and all 124 real books. Category focus, selecting an actual
book and Escape return/exit work. Native walking reaches the occupied ground
case for front/oblique inspection. Sustained forward input stops at z=-14.308
before the new case front; books remain supported on their boards. No console
errors. Upper shelves are covered by the all-row geometry/runtime regressions;
they contain no fake catalog books for browser display.

Screenshot: `.artifacts/model-clearance/book-fit-shelves-r10.png`.
Runtime/interaction/console evidence:
`.artifacts/model-clearance/book-fit-shelves-runtime-r10.json`.
The 4175 preview and 8080 API health checks pass.
No commit, push or deployment performed. All editable source and runtime assets
remain in this managed worktree, separate from the ordinary-page layout work.

---

# Recessed side windows, r9

Revision: `20261019-recessed-windows-r9`. This supersedes the r8 source hash below.

All twelve side windows use closed stone jambs, stepped sills and true pointed
spandrels around clipped diamond glazing. One continuous central mullion, one
slim transom and connected twin-lancet/quatrefoil tracery replace the thick
repeated bars and disconnected rods. No screenshot, rectangular sky plate,
transparent mask or new image asset is used. The glazing is opaque, subtly
toned architectural glass; no exterior landscape or physical transmission is
claimed.

Source SHA-256: `151cb217c711c64420851d3cc77c5d8c66345f58bbbd159c8242ee8b33df16c0`.
1,506,423 triangles, 13 runtime modules, 30 materials and 12 preserved image streams.
The two new glass materials provide restrained cool and warm pane variation.
All collider descriptors, stair routes, shelves, art-gallery and crosswalk
contracts are identical to r8.

Final exported GLB ray probes passed at 360 window samples across all twelve
openings. Both pointed high corners close with stone; each window has visible
glazing with no unsealed sample. Fourteen passage doorways, 84 shelf-row margins,
landing support, route head clearance, end walls and crosswalk checks pass.
Ordered triangle/attribute equivalence across all 13 runtime modules passes.

`pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` passed (103 files,
398 tests). Material-bank regressions now derive their expected capacity from
the manifest and explicitly require both new glass tones. The build retains
the existing large-chunk advisory.

Authenticated browser inspection confirms the r9 revision, all 13 modules
resident with zero failures, 1,506,423 architectural triangles, 1,156 collision
shells and all 124 real catalog books, with zero browser console errors.
The front and oblique window views show
continuous jambs, connected tracery and diamond panes. Sustained native forward
input stops at x=14.598 before the right window wall; the camera does not cross
the glazing. This is a window inspection, not a repeat of the r8 stair-walking
acceptance below.

Screenshot: `.artifacts/model-clearance/recessed-windows-r9.png`.
Runtime/pose/console evidence: `.artifacts/model-clearance/recessed-windows-runtime-r9.json`.
The editable packed `.blend`, source GLB, generator fragment and runtime modules
are retained. Local preview health passes on 4175/8080. No commit, push or
deployment was performed.

---

# Expanded stair landings, r8

Revision: `20261019-stair-landings-r8`. This supersedes the r7 asset hashes below.

Both upper landing zones expand from 1.5 × 1.35 to 3.05 × 2.4 estimated model
units toward the outer gallery. A wider flush tongue and infill supply support;
the existing end crosswalk supplies the rear resting area. The former outer
landing return no longer cuts across supported floor; the aperture railing now
follows the exposed edge. The inner guard and connected handrail remain.
The two stair-corner scholar niches are omitted, including their collision
shells, because the new floor would bury their bodies. The structural column
piers remain solid; the gallery turn passes behind them.

Current source SHA-256: `80614b9289430cf15d71b8a8f37de42f729c6b3e72cb242e340263568c2345e5`.
1,430,907 triangles, 13 runtime modules, 28 materials, 12 unchanged image streams.
1,096 descriptors expand to 1,156 runtime collision shells.

Exact ordered triangle/attribute preservation passed. Final GLB floor ray
probes cover both widened platforms and infills. Fourteen doorways, 84 shelf
rows, both end crosswalks, stair-route head clearance and helical guards pass.
Walking regressions cover both stair directions and the newly open outward
exit followed by a turn into the gallery, including reverse traversal.

`pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` passed on the final
revision (103 files / 398 tests). The earlier full run caught one obsolete
expectation requiring the removed outer return; it was updated to verify the
remaining exposed-edge guards, then the entire suite passed.

Final authenticated browser acceptance passed after the last build. All 13
modules are resident, with zero failed modules, 1,430,907 resident triangles,
1,156 collision shells and all 124 real catalog books. The console has no errors.
Native WASD traversed both stair upper segments down and back up, crossed the
former outer-return position, entered both galleries and returned. The final
capture records 34 poses with changing stair height and constant 7.98 eye height
on the resting platforms. These checks cover the changed upper junctions, not a
new full manual ground-to-gallery traversal of every step. The source routes
are byte-identical to r7 and full up/down walking regressions also pass.

Inspected the enlarged platforms at eye height: complete floor support, no
scholar figures protruding through the floor, no remaining narrow outer return.
The structural piers and inner guard remain. A guided left stair ascent also
reaches the upper floor in the final browser revision.

Final screenshot: `.artifacts/model-clearance/stair-landings-r8.png`.
Runtime, native-input poses and console evidence:
`.artifacts/model-clearance/stair-landings-runtime-r8.json`.
Config scope comparison: `.artifacts/model-clearance/landing-config-diff-r8.json`.
The local 4175 preview and editable `.blend` / source GLB are stable. No commit,
push or deployment was performed. The independent ordinary-page layout work in
the original main checkout was not modified.

---

# A-end art exhibition wall, r7

Revision: `20261018-art-gallery-r7`.

The four scenery bookcases flanking the A-end portrait are replaced by four
independent framed paintings. The central reader portrait, fluted pilasters,
cornices and widened floor remain. The two bronze niche sculptures and their
collision shells are removed because they obstructed the paintings. The real
catalog side shelves and their allocation are unchanged.

The new art uses one original generated four-quadrant oil-painting atlas, with
separate canvas meshes and inset UVs. Authoring input and provenance are recorded
in `scripts/hogwarts-library/GALLERY-ARTWORK.md`. The 11 prior runtime image
streams remain byte-identical. The additional atlas raises shared image count
to 12; the new canvas material replaces the removed bronze material, retaining
28 exported materials.

## Verified source and delivered assets

- Packed editable source: `scripts/hogwarts-library/deliverables/library-source.blend`.
- Exported source: `scripts/hogwarts-library/deliverables/architecture-uncompressed.glb`.
- Source SHA-256: `285de7d2d369258e0c96121c24fa3d347e62e2af713e3bcd6c5417bc58eaa613`.
- 1,474,630 source triangles, preserved exactly across 13 runtime GLBs.
- 1,102 descriptors expand to 1,162 runtime collision shells.
- Actual GLB ray probes see the gallery painting material at all four centers
  and at the former shelf-row locations, with no boards or statue obstruction.
- The original central portrait remains visible and clears its cornice.
- Crosswalk A has 3.30 m physical clearance and a 2.70 m continuous body-clear
  band; B retains 2.80 m / 2.20 m. These are estimated model units. Floor, roof,
  end wall and side-gallery connectivity checks passed.
- Fourteen door openings, 84 shelf-row clearances, stair exit support and route
  head clearance passed against the final exported source.

Current generated JSON reports bind all checks to the source SHA above.

## Application and browser acceptance

`pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed. The full suite
passed 103 test files / 397 tests, including both stair directions, ordinary
walking support and full-body transverse corridor traversal. No backend changed.

The authenticated local browser loaded r7 with all 13 modules resident, zero
failed modules and all 124 real catalog books. Inspected the wall frontally and
from raised views: the five artworks display correctly, no former shelf boards
remain, frames are separate and the bronze statues no longer obscure the wall.
The browser console had no errors. The saved overall image uses vertical-flight
camera positioning for inspection; it is not itself evidence of stair walking.

Screenshot: `.artifacts/model-clearance/art-gallery-r7.png`.
Runtime capture: `.artifacts/model-clearance/art-gallery-runtime-r7.json`.
The local preview remains on port 4175. No commit, push or deployment performed.

The pre-existing architectural-occlusion issue in shelf picking remains outside
this art-wall change. Full manual browser stair traversal was established in r6;
r7 preserves its navigation implementation and reruns the corresponding tests.


---

# Exhibition end roofs and exterior-wall closure, r16

Revision: `20261019-roof-enclosure-r16`.
Source SHA-256: `5ec1ffcb8f2738615e554611943030a8d652cb399491ade2ddee1aa4f7128221`.
Config SHA-256: `9bec7a93fa1feea1eb4571364c403f05d8372c9522c6ca622a2d42a442b60148`.

The r15 flat blue end soffits visibly projected over the exhibition walls.
Both exterior side walls also lacked their middle bands beyond the last windows,
and the main/side vault junction had an unsealed narrow gap. Four curved end
barrels now replace those slabs, with matching ivory tracery, timber ribs and
backing. Solid stone closes the four end wall bands. Narrow timber transitions
join the main vault to the side vaults, with inter-bay seams closed.

The runtime roof envelope follows the new end curvature and transition.
No shelf, artwork, book, stair, floor, standing-body collider or hall dimension
was moved for this change. The source has 1,355,089 triangles, 28 materials and
12 embedded image streams. Exact triangle/attribute/material/image preservation
passed for all 13 delivered modules. Source colliders remain 1,112 and expand
to 1,188 runtime bounds. All ten current geometry reports bind this source.

`reference-library-roof-enclosure.json` records 36 exterior-wall probes, 60
curved-vault probes and 162 junction probes, with no failures. End-vault probes
select the first blue-vault surface so the existing artwork frames and shelf
cornices are not mistaken for a ceiling. The former flat blue slabs would
still fail the curvature test. The elevated cornice-to-enclosure check now
measures the actual nearest surface, including end-vault timber ribs, and
requires the same 2-unit minimum instead of assuming a bare stone wall.
Full standing-body aisle width remains separately tested on both floors.

Frontend lint, typecheck, all 104 test files / 407 tests, and production build
passed. Build retains the existing large-chunk warning. Geometry, shelf support,
stair exits, crosswalks, outer aisles, painted arcade soffits and rigid fixture
checks passed. No backend changed.

Authenticated browser acceptance loaded all 13 r16 modules with zero failures
and all 125 catalog books. The left stair ascent reached y9.22; native walking
across the exhibition crosswalk and along the upper window-side aisle reached
the opposite end. Both end roofs were inspected; the B-end detail uses vertical
flight to y11.909 for roof inspection, not as evidence of stair walking.
No console errors were captured.

Evidence:
- `.artifacts/model-clearance/roof-end-gallery-r16.png`: user-comparable A-end view.
- `.artifacts/model-clearance/roof-opposite-end-walk-r16.png`: upper-floor B-end view.
- `.artifacts/model-clearance/roof-opposite-end-detail-r16.png`: raised B-end roof detail.
- `.artifacts/model-clearance/roof-runtime-r16.json`: runtime and native-input poses.

Local preview remains at http://127.0.0.1:4175/virtual-library.
No commit, push or deployment performed.

## Occlusion-aware shelf and book picking

Selection previously raycast only the invisible interaction proxies, allowing
hits behind floors and walls. `virtual-library-picking.ts` now checks the live,
visible architecture meshes before accepting a shelf, book, portal or terminal
hit. Pointer hover uses the same check. Actual mesh openings remain clear;
hidden objects and invisible helper/semitransparent materials do not occlude.
The already-inspected book retains its independent foreground interaction.
The shared ray's proven clear/blocked distance ranges are reused between hits.

Ten real Three.js raycast tests cover upstairs floor occlusion, walls, clear
same-level targets, geometry beyond the target, hidden ancestors/materials,
real openings, ray-range restoration and visible/hidden BatchedMesh instances.
Lead reviewed the Alibaba subagent's test file. All 105 files / 419 tests,
lint, typecheck and production build passed. Existing jsdom CSS warnings and
the existing build chunk-size warning remain. No geometry/backend changed.

Authenticated browser checks on the built local preview:
- Ascended the left staircase to y9.220. Clicking the upper crosswalk floor at
  viewport (640,395), pitch0.3015, did not focus/highlight a shelf or inspect a
  book; the camera remained at (-6.800,9.220,-16.232).
- After moving to the left upper gallery, clicked a visible upper cabinet at
  (790,432); shelf focus opened correctly and Escape restored navigation.
- Focused Fiction, clicked a visible book, and rotated its inspection by
  yaw0.660/pitch0.160; Escape closed inspection and shelf focus correctly.
- No browser console errors. User preview was refreshed after verification.

These browser observations supplement the controlled floor/wall ray tests;
they do not claim exhaustive pixel/viewpoint coverage.
Evidence: `.artifacts/model-clearance/picking-floor-r18.png`,
`picking-book-r18.png` and `picking-runtime-r18.json` in the same directory.
No commit, push or deployment performed for this change.

---

# Both end-wall structures and lower frames, r17–r18

Final revision: `20261019-end-structure-r18`.
Source SHA-256: `91c03bd726ebf2c69a96735d6ef4f8015d5a3e7a5d32a347c7d137669741be57`.
Config SHA-256: `8492d68a850c47d7490d57efac7b7b46d82ad80310f66a5e3be9bc03443546d8`.

At the A end, ten staggered cameo frames crossed the column lines and the
central door trim extended beyond its bay. Four complete lower frames now
align with the four side-bay axes. The door width alone is reduced to 70%; its
height/depth remain unchanged. Solid timber spandrels join all five arch rings
to the gallery underside at y6.888. Lower wainscot stops at y1.278, below the
picture perimeter at y1.302, so it cannot protrude through the canvas.

At the B end, three pointed outlines were centered on the support piers and
terminated below the balcony, while two wheel-panel frames stood roughly 1.6
units in front of the rear wall. Two complete rounded support arches now span
BETWEEN the three retained piers, with solid heads meeting the balcony underside
and a connected beam at y6.408–6.888. The old pointed outlines are removed.
The two lower frames now have solid backing against the rear wall, with
connected wheel hubs and actual-depth collision shells. The original balcony
footprint, upper gallery crosswalk, railings, corbels, upper A-end exhibition,
all 28 double-sided catalog cases and book proportions are retained.

Source colliders: 1,342; runtime bounds: 1,418. Actual GLB triangles: 1,352,839.
Exact preservation of triangles, attributes, materials and all 12 shared image
streams passed for all 13 delivered modules. Twelve current source reports
were checked against the final source SHA; every report that includes a config
hash matches the final config. The r16 curved roof/wall closures remain tested.

`verify_end_arcade.py` checks 252 canvas/frame rays at 0 and ±12 degrees,
75 spandrel probes and 30 clear-aperture probes; all pass. Its r16 negative
control has 295 failures, including actual frame-depth/visibility and missing
spandrel failures independent of revision. The measured final door-crown half
width is 1.1746 rather than 1.678.

The Alibaba execution subagent supplied `verify_end_b_support.py`; lead review
inspected its implementation and actual report. All 59 B-end probes pass.
The old r17 negative control fails 24 checks, including support heads and
wall-panel depth. These exported-geometry probes are separate from browser
acceptance and do not claim visibility from every possible viewpoint.

Frontend lint, typecheck, all 104 test files / 409 tests, and production build
passed. New body tests cover the five A-end passages and solid heads, four rear
pictures, both B-end support openings/heads and both rear panels. Existing
window aisles, crosswalks and stairs also pass. Build retains the existing
large-chunk warning. No backend changed.

Authenticated browser acceptance loaded all 13 r18 modules, 125 real catalog
books and 1,418 runtime bounds with zero failed modules and no console errors.
Both ends were inspected frontally and obliquely. Ground keyboard walking
through the left B-end support opening reached x−1.095, y1.780, z17.121.
The overview screenshots use raised flight positions, not stair-walking
proof. At wide angles, foreground stairs/piers can naturally occlude rear
artwork; this change fixes structural intersections and tests the stated
modest frame-view angles, not arbitrary-angle visibility.

Evidence:
- `.artifacts/model-clearance/end-arcade-after-r18.png`: A-end frontal result.
- `.artifacts/model-clearance/end-arcade-oblique-r18.png`: A-end oblique result.
- `.artifacts/model-clearance/end-balcony-after-r18.png`: B-end frontal result.
- `.artifacts/model-clearance/end-balcony-oblique-r18.png`: B-end oblique result.
- `.artifacts/model-clearance/end-walls-runtime-r18.json`: runtime, native poses and errors.

Local preview: http://127.0.0.1:4175/virtual-library.
No commit, push or deployment performed.


## r19: upper exhibition pilasters

Revision `20261019-gallery-pilasters-r19` removes only the two obsolete
sculpture-niche backboards, pointed stiles and rosettes at the A-end upper
exhibition. Those assemblies overlapped the x=±7.1 fluted pilasters. All six
structural columns, their existing mouldings, five artworks and circulation
layout remain. The generator, editable blend, uncompressed source, scene config
and thirteen exact runtime modules were regenerated together.

Source SHA-256: `cba1206459111a4002eb6c9808f4b3b740a7a61616fa1650880cf534df2bece3`.
Config SHA-256: `90aae9220aeccc9fbd665f520cb4611e55fb7e3cf42fef0cd6e6053c83f23fdd`.

Two bounded tool-using execution workers called the authorized Alibaba API
through the existing loopback free-quota relay (actual upstream qwen3.8-flash).
Native subagent creation rejected the old custom model aliases in this app
session. Workers were restricted to their named files; credentials stayed in
the existing user-local credential file outside the repository. The live quota
console confirmed the four remaining queue candidates had free-only switches
enabled. No paid fallback was configured or requested. Worker scripts/task
inputs/logs remain ignored local artifacts, not project dependencies.

Lead review corrected false positives in the execution worker's geometry
verifier: the wider shaft collar begins at y14.658, and solid joinery must not be
judged by surface-section graph connectivity. The final verifier checks actual
clipped triangle area outside the retained pilaster envelopes, visible timber
members at explicit profile heights and five artwork grids at stated local
angles. It does not claim continuous volumetric/manufacturing connectivity.
Current geometry passes; the saved r18 negative control fails both obsolete
niche regions without using its revision string as a rejection criterion.

The category worker found no justified test-code change: the failing lookup
already awaited findByRole. The unchanged category file passed all eight tests
in isolation; the full unchanged suite then passed 105 files / 419 tests under
normal load. The earlier lone failure occurred during simultaneous geometry
work and did not reproduce; resource contention remains an inference. Lint,
typecheck and production build passed. Existing CSS/jsdom and chunk warnings
remain. Geometry, exact compression, end walls, passages, roof, rigid features
and walk clearance were rechecked against the final source. The first walk
run raced the old preservation report; after module verification completed,
the rerun passed (14 doors, 336 book-row samples, 1,342 descriptors).

Local preview recovery reused the database's existing main-library path via
BOOKKIN_LIBRARY_MAIN; no root record was changed. API/worker still launch
through pnpm start:local with immutable JAR snapshots. The frontend is available
at http://127.0.0.1:4175/virtual-library.

Authenticated browser acceptance ascended the left stair to y9.220, then used
the existing elevation controls for column-head, frontal and oblique review.
The raised overview is a flight inspection, not a standing/walking screenshot.
Both former niche overlaps are absent, all five artworks remain, all model
modules are ready with zero failures, and the console has no errors. The user
preview was refreshed. Evidence: gallery-pilaster-close-r19.png,
gallery-pilasters-overview-r19.png, gallery-pilasters-oblique-r19.png and
gallery-pilasters-runtime-r19.json under .artifacts/model-clearance/.

No commit, push or deployment performed.


## r20: wider bookcases and continuous outer passages

Revision `20261019-wide-shelves-r20` follows the user's confirmed horizontal
width/thickness request. The hall becomes 40×40 model units. Ground case
faces grow 4.95→6.55 (+32%); upper faces grow 3.48→5.08 (+46%). Inner
edges remain at 9.45/11.10. Stiles grow .17→.24, backs .12→.16 and boards
.126→.168. Double-faced cabinet depth grows .78→.82; the book rear gap
.024 and front inset .018 remain. Real book size, 28 double-faced cabinets,
56 selectable faces, six rows and twenty slots per row remain unchanged.

Both sides of both floors have a continuous 3.0 model-unit standing-height
clear band at |x|=16.5…19.5. Wall/window assemblies, ground paving, gallery
floors, end-wall spans and side roofs extend together. Mid-body width rays
measure 3.78 lower / 3.60 upper; these are not a full-height minimum because
window sills project further inward. The guaranteed full-height band is 3.0.
Upper inner stiles/plinths are rebated into the cabinet so the original
1.805 minimum inner door aperture is retained despite thicker joinery.

Source SHA-256: `d5460c8879bde5443bb0a323eb1be7973309ee1d95d9e90ef7867409973f2189`.
Config SHA-256: `3718e80f2cf1237d7632b79a69a370515712e7b906b0f6a8ec50a4d9aa1e9ea6`.
All thirteen current-source reports match the final source/config hashes.
All thirteen runtime modules preserve the exact ordered triangle-attribute
multiset, materials and image bytes (1,434,691 runtime triangles).
The final physical walk check passes 14 doors and 336 book rows with 1,342
collider descriptors. Source geometry, end walls, crosswalks, outer aisles,
arcade soffits, roof enclosure, A-end arcade, B-end supports, rigid features
and exhibition pilasters all pass. The saved r19 negative control lacks floor
support at all eight new-lane floor probes; the current source supports all eight.

Two bounded Alibaba API tool-using workers were assigned disjoint regression
and verifier files through the existing free-only loopback relay. The model
queue rotated from exhausted qwen3.8-flash to Alibaba-hosted
deepseek-v4-flash-0731. The test worker completed; the verifier worker reached
its bounded turn limit after updating the outer-aisle verifier. Lead review
corrected floor-support identifiers, cavity arithmetic and final probe heights,
and completed the remaining verifiers. No new credentials or paid fallback
were introduced. Worker inputs/logs remain ignored local artifacts.

Lint and typecheck pass. The full frontend suite passes 106 files / 425 tests
with two workers. An earlier default-parallel run had one unrelated
CategoriesPage 15-second timeout during concurrent geometry work; the test
was not modified or weakened. After the final upper-door rebate geometry,
the five affected test files pass again (49 tests) and the production build
passes. The existing chunk-size warning remains.

Authenticated browser acceptance traversed every wall-side lane across all
seven case boundaries at standing eye heights 1.780 / 9.220, using the stair
route to reach the gallery. All four endpoints report collision clear. End
crosswalks connect the lanes. The widened Fiction case shows the existing 28
real books; clicking a visible spine opens the correct reader link, and Esc
returns through inspection and shelf focus to enabled walking controls.
Book drag rotation was not established by this acceptance check.

The user preview was refreshed and confirms revision r20, phase ready, all
13 modules resident, 125 real books and zero failed modules. Its fresh console
has no errors. The long-lived QA tab retained one earlier Three.js isReady
error at 12:52:48Z; the cause was not established and it did not recur on the
fresh final load.

Evidence under `.artifacts/model-clearance/`: outer-aisle-lower-r20.png,
outer-aisle-upper-r20.png, wide-bookcase-r20.png,
wide-shelves-runtime-r20.json and outer-aisle-negative-r20.json.
Local preview: http://127.0.0.1:4175/virtual-library.
No commit, push or deployment performed.


## r21: bilateral window daylight

The browser previously created one strong directional light at x=10 inside the
hall. It did not correspond to either outer window wall and caused persistent
one-sided shading. The new browser-only lighting contract mounts twelve equal
inward-facing RectAreaLights just inside the actual windows at x=±19.78, z at
the six window centers, within the straight-sided lancet portion. Daylight is
an overcast diffuse approximation; there is no directional sun in this preset.
Three warm points stay at the existing central fixture anchors; the middle
fixture casts local shadows using one 1024 cube map (six faces). Ambient and
hemisphere fill are reduced so recesses retain shading.

RectAreaLightUniformsLib initializes the WebGL LTC textures. RectAreaLights
have no shadow support and can leak diffuse light through occluders; this is
not baked or ray-traced GI. Local chandelier shadows remain separate. See the
Three.js official RectAreaLight documentation. The reproduction helper is
browser_lighting.py and the generator calls it using the generated windows.

All non-lighting config fields exactly reconstruct the r20 config hash
3718e80f2cf1237d7632b79a69a370515712e7b906b0f6a8ec50a4d9aa1e9ea6.
The new full config hash is
481c65bd92c84cf5eeb59f733e84432011aaa127287db5b55a070fb9416d1dfe.
The source GLB and runtime geometry are unchanged. Earlier geometry acceptance
reports remain evidence for their original r20 geometry/config pair; the new
reference-library-lighting-r21.json establishes the lighting-only bridge.

The lead implemented runtime/config changes. Two bounded Alibaba-hosted
DeepSeek worker attempts did not produce the requested test file (first hit
the turn bound reading the large config; compact retry returned no artifact).
The lead completed and reviewed the three lighting regressions directly.
They check every source against real window apertures, mirrored emitting
normals/intensities, absence of an indoor directional sun, fixture anchors,
local shadow budget and legacy config compatibility. Full frontend validation
passes: lint, typecheck, 107 files / 428 tests, and production build. Existing
jsdom CSS/canvas warnings and the large-chunk build warning remain.

Browser evidence is captured under .artifacts/model-clearance with r21 names.
Acceptance checks actual hall and gallery window lighting, model readiness,
real catalog presence and console errors. No physical light simulation or
performance benchmark is claimed. No commit, push or deployment performed.


## r22: real catalog binding appearance

The former books had one identical thick profile, a rough antique material,
oversized five-character outlined labels and a broad white paper block. The
new binding keeps each actual catalog identity/front cover and uses its
readable cover perimeter for the stock/spine color. An unreadable/CORS cover
uses deterministic cloth color without breaking selection. Spine printing
uses the full title and actual author, with adaptive size and multiple columns
for long titles; no invented publisher or fake metadata is drawn. Author is
part of the appearance replacement signature.

The reserved shelf volume/capacity/depth remains unchanged. Real rendered
bindings use deterministic ID-derived thickness (40–66% of the prior spine)
and height (89–100%); these are visual estimates, not edition dimensions or
inferred page counts. Tail offsets follow height so every binding rests on the
original shelf plane. The .288 depth stays fixed. Shelved clusters pack by
actual thickness and disjoint minimum .075 hit lanes; no random lean or filler
book is added. Front/back cover boards become .0032 in local model units.
The spine text lies on a lightly curved surface; shoulders, headbands and
hinges are fine rather than heavy. Inspection scale grows to 3 desktop / 1.8
mobile, retaining proportional transforms and the left-side preview.

A bounded Alibaba-hosted DeepSeek worker produced catalog-book-surfaces.ts.
Lead review corrected paper stack direction (through thickness, not height),
lightness and leaf frequency before integrating it. The head UVs turn the same
shared paper map so leaves continue onto the head without another material
or extra page-head draw. Linen relief is shared and subtle; per-book stock
colors use cloned materials with shared maps. Cover observers detach on book
removal; scene disposal clears the shared observer map so late loads cannot
repaint disposed books. No new external image assets were generated.

The architecture/module bytes, circulation, shelf geometry and r21 lighting
are unchanged. Focused regressions cover shelf support on every case face,
deterministic varied proportions, reserved depth, non-overlap, paper texture
direction/lightness, cloth determinism, complete title/author printing and
cover-sampling fallback. Existing catalog sync/removal and picking tests remain.
Browser evidence under .artifacts/model-clearance uses books-before-r22.png,
book-binding-detail-r22.png and book-page-detail-r22.png. The source cover and
its original quality bound the visual realism; no missing rear-cover scan,
actual spine scan, page count or edition dimensions is invented.


Final r22 validation: lint, typecheck, 108 test files / 434 tests and production
build pass. The initial full run had one stale uniform-width assertion in the
physical twenty-book row check (3.276 fixed width). It now asserts disjoint
actual hit boxes with .004 gaps, their exact summed span, the original maximum
reservation, and both exported-stile clearances. No clearance was reduced or
book removed. The subsequent complete suite passes. Existing jsdom CSS/canvas
warnings and the large-chunk build warning remain. Browser testing confirms
125 catalog books, correct visible-book reader links, rotation to spine and
fore-edge views, and direct switching between two adjacent narrow bindings.
No commit, push or deployment performed.

The refreshed user preview confirms r22, 125 real catalog models, architecture ready with zero failed modules, and zero fresh console errors. Final screenshot: book-realism-final-r22.png; runtime evidence: book-realism-runtime-r22.json. Desktop rotation/adjacent switching were exercised; no new mobile browser acceptance is claimed.


## r23: windows on both left storeys

The former left lower wall was opaque; six left upper windows already existed.
Six new ground-left openings now use the same connected recessed lancets,
diamond glazing, mullion, transom, pointed head and supported sill. Both left
floors have six windows (12 left total), and the six right upper windows remain.
Lower sill/spring/crown are 1.08/5.08/6.12 below the7.44 gallery floor. The
lower window helper remaps only its newly appended window vertices, leaving
all earlier windows untouched. Wall infill is removed at these apertures, with
opaque sill/head/pier/end bands retained. The solid exterior-wall camera shell
still encloses the glazing; no new passage or route outside the building is
introduced. Full-height3m side-walk clearance remains.

The generated windows.storeys contract drives18 diffuse opening lights,
including the six new lower left sources. Existing warm fixture anchors,
one local shadow source, book realism, shelves, stairs and exhibition layout
remain. The geometry cache namespace is r23, synchronized with the generated
manifest/config. An initial frontend run caught the old r20 cache namespace;
updating the source revision resolved it without weakening the manifest test.
The subsequent full suite passes108 files /434 tests; lint, typecheck and
production build pass. Existing jsdom/CSS and large-chunk warnings remain.

Source SHA-256: `7a6e012e09b7faeeea70ae1e1001f424c48ed14486ae008aeb62ba2b1b915c55`.
Config SHA-256: `573818ab173556ea1d70bf23b3a75b7b9fa9bb611a5ab647774dfe8addb258c9`.
Fourteen current-source reports agree. Exact compression preserves all
1,487,965 ordered triangle attributes/materials and original image bytes across
13 runtime modules. Walk clearance passes14 doors and336 book rows with the
unchanged1,342 collider descriptors. Source geometry, end walls, crosswalks,
outer aisles, soffits, roof enclosure, end arcade/supports, rigid features and
upper exhibition pilasters pass. The soffit verifier's passing JSON stdout
was saved to its report path (it does not write a report without --json).

The new storey-window verifier samples16 clear-pane interior rays per actual
window plus seven pointed-head sealing rays. All18 windows pass; no opaque
wall appears before the glazing. The saved pre-r23 source fails all six lower
left apertures (0/16 glass-first hits each) while all12 old upper apertures
remain visible. This negative control uses current expected coordinates and
metadata against old geometry, rather than rejecting an old revision string.

A bounded Alibaba-hosted DeepSeek attempt returned no requested verifier
artifact. The lead completed/reviewed the verifier directly. Native browser
acceptance and saved images are separate from the source geometry reports.
No commit, push or deployment performed.

Browser delivery: left-lower-window-r23.png shows a real first-floor window from eye y1.780 with collision clear; the previous wall image is left-lower-windows-before-r23.png. The lower route was traversed through several window bays. Upper windows pass exported visibility/sealing checks and remain unchanged; a comparable new standing upper screenshot was not established during later aerial inspection. left-storey-windows-runtime-r23.json records the scope. The independent fresh r23 preview is ready with125 books, zero failed modules and zero fresh console errors; the user's existing categories tab was left unchanged. The agent-mounted Blender volume was ejected.
