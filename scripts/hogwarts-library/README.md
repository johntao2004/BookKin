Current model: `20261020-end-b-door-r38`. A closed paneled timber double door with brass hardware occupies the B-end ground wall between its two compass panels. The door stays flush to the wall, with its own collision; all r37 architecture and the gallery globe remain.

Previous model: `20261020-gallery-globe-r35`. The existing globe stands on the A-end projecting upper platform below the central portrait at x=0, z=-15.0, baseY=7.44. Its dimensions are unchanged and collision follows it; retain the r34 vault repairs and ground-level search orb.

Previous model: `20261020-end-vault-junction-r34`. A-end upper paintings retain their timber backs, frames and canvases against the continuous end wall; redundant raised stone patches that cut the cross-barrel soffit are removed. End-gallery timber ribs now project below the soffit with embedded backs instead of coplanar visible faces. `verify_end_vault_junctions.py` checks the exported geometry and rejects the pre-fix model.

Previous model: `20261020-globe-setback-r33`. The single floor globe is set back from z=10.2 to z=8.0 to leave more room in the initial view; its collision and streamed-module bounds follow the new position.

Previous r32: `20261020-foreground-globe-r32`. The foreground table, two benches and lamps are removed; the existing floor globe moves from z=-11.7 to z=10.2 together with its collision. The other two tables and r31 architecture remain.

# Upper balcony revision

Previous r31: `20261020-open-upper-balcony-r31`. The B-end upper balcony omits its six decorative piers and central/side arch screens, including their pier collisions. Rear wall, upper panels, cornices, balcony and stair geometry remain.

# BookKin high-detail modular library

Retained stair crosswalk (`20261020-stair-crosswalk-r30`): The A-end center deck and its front guard extend from z=-15.6 to z=-13.5, flush with both stair outlets. The former internal longitudinal guards are removed so the platform is continuous. Both spiral edges have profiled timber handrails, tread-mounted balusters and supported upper returns; inner guard collision arcs retain the radius-1.3 walking lane. `verify_stair_crosswalk_extension.py` measures exported floor support, timber rails and exit clearance against the previous model.

Previous r29: Both lower end aisles omit the freestanding piers, arch screens, attached brackets and their collision shells. Rear artwork, walls, stairs, balcony and horizontal beams remain. `verify_open_end_aisles.py` verifies exported clearance against the prior geometry.

Previous model: `20261020-balcony-miters-r28`. The B-end balcony uses shared miter rings for both rails and a stitched platform/fascia, with continuous length UVs and no internal segment caps. `verify_balcony_joinery.py` checks the exported solids and rejects the r27 baseline. Browser close-up evidence: `docs/verification/library-r28-balcony-joints-2026-10-20.png`.

## Current revision

`20261020-lower-gallery-r27` replaces the A-end ground rear decorative door
and four silhouette panels with five textured framed paintings. The center
portrait has a plain rectangular frame; door leaves, arched door trim, handles
and the former door collision shell are omitted. Four side canvases reuse the
approved original painting atlas. All five follow the structural arcade bay
axes, with rigid local artwork dimensions and individual picture collisions.
The lower structural arcade, sealed rear wall, low side wainscot, open passage
bays, paired stairs and upper exhibition wall remain.

`verify_end_arcade.py` checks 705 image/frame rays at frontal and +/-12 degree
views, 75 solid spandrel rays and 30 open-arcade rays. Actual old door material
is absent; the saved r26 geometry fails image/door acceptance independently
of its revision string. Source checks verify image-texture bindings and exact
canvas bounds; all 13 compressed modules exactly preserve the source triangles
and original image bytes. End-wall, crosswalk and Blender walk-clearance checks
pass. Lint, typecheck, 40 focused tests and build pass; no full-suite run was
repeated for this asset-only follow-up.

Browser front, oblique, close and overview views pass on r27 with no captured
console errors. Evidence is stored separately under
`.artifacts/model-clearance/lower-gallery-runtime-r27.json` and the four
`lower-gallery-*-r27.png` screenshots. No commit, push or deployment is implied.

## Previous upper exhibition revision

`20261019-plain-exhibition-wall-r26` removes all six fluted decorative
pilasters and their independent upper/lower surround cornices from the A-end
upper exhibition wall. The five artworks, their individual frames (including
the central Gothic portrait frame), the exterior wall, lower structural arcade,
and gallery/stair geometry remain. This supersedes r19's preservation of those
six exhibition-wall pilasters.

`verify_gallery_pilasters.py` clips actual exported timber triangles against
six former-pilaster footprints, excluding the preserved floor below 7.55 and
only the outer Walnut roof backing above 15.0 behind -19.60. All six footprints
are clear; the saved r25 baseline fails all six. All 1575 artwork visibility
samples pass. The exact 13-module triangle proof, end-wall, structural arcade,
crosswalk and Blender walk-clearance checks pass on the r26 source/config.
Lint, typecheck, 40 focused tests and build pass. A full-suite run was not
repeated for this asset-only follow-up; browser evidence is recorded separately.

## Previous guard revision

`20261019-guard-joinery-r25` repairs the aperture/landing guard joinery. Each
corner has one structural newel; the gallery endpoint reuses its existing
newel. Straight moulded handrails enter the shaft faces, and .12-wide turned
spindles stand clear of every newel, with no duplicated endpoint spindles.
The former .48-long offset return is removed. A continuous L-shaped platform
supports the straight guard and meets the side gallery without overlapping
coplanar floor faces or an internal beveled seam. The stair turns, tread count,
walking radius, body radius and enlarged resting zone are retained.

`verify_guard_joinery.py` measures 70 actual exported spindle/handrail sections
and rejects the saved r24 geometry. Existing stair/body, doorway, book-support,
window/aisle/roof and exact-module checks are rerun on the final source. Browser
close views and runtime poses are kept separately under
`.artifacts/model-clearance/guards-runtime-r25.json`; source checks alone do not
constitute browser acceptance.

R25 validation: lint, typecheck, the 40 focused guard/stair tests and the build
pass. The full single-worker run passed 431/434 cases; the three failures were
in CategoriesPage during resource pressure. That unchanged file then passed
all eight cases in an isolated rerun. This is recorded as an aggregate rerun
result, not a single clean full-suite run. Model evidence and browser evidence
remain separate.

### Retained r24 stair circulation

`20261019-tangent-stair-landings-r24` supersedes the earlier stair footprint,
rotation and landing notes below. Both centers move inward to x=±5.9, z=-13.5
so ascending bodies clear the ground arcade. The mirrored spirals have 40 treads,
7.44 rise, a 1.3 walking radius and 1.25 turns (450 degrees); this gives an
approximately 36-degree walking slope instead of the former approximately
50-degree slope. Bottom approaches enter tangentially from the hall side and
upper exits head north into the A-end crosswalk without a forced quarter-turn.

The newly supported north half of each stairwell joins the crosswalk to form a
5.3-by-4.2 resting/turning zone (including the adjacent crosswalk). Perimeter
guards protect exposed edges; the helical rail terminates at the adjoining
newel, with no diagonal connector across the walk lane. The center shaft ends
beneath the platform. The 0.3 body radius is unchanged. These are estimated
model units, not surveyed architectural dimensions.

`verify_stair_landings.py` checks 80 actual floor samples plus a 1.0-wide swept
exit band, and rejects the retained pre-r24 GLB as a negative control.
`verify_walk_clearance.py` checks full-body horizontal and head rays along both
routes, 14 doorways and all 336 book rows. All thirteen compressed modules retain
the complete ordered source triangle/attribute multiset. Source SHA-256:
`d1f8a1442a8346a48d37a91c0b33cf97c48318641a5366c13e2e05cb1bd529b3`.
Config SHA-256:
`e946c3d913a5ba090b74bb52a2bde084fb6e519820a70e6ea9824fb664b6f374`.
Frontend lint, typecheck, 434 tests and build pass. Browser evidence is recorded
separately in `.artifacts/model-clearance/stairs-runtime-r24.json` and the
`stair-*-r24.png` screenshots; it does not imply deployment or Git delivery.

### Earlier revisions and retained architecture

All 14 remaining small gallery scholars (12 side-wall figures and two A-end
figures) are removed together with their timber niche frames, plinths and
12 collision shells. Structural piers, gallery guards and paintings remain.
The historical sculpture helper is no longer executed by the generator.

Both architectural stories are 20% taller: the gallery floor rises from 6.2
to 7.44 and the central vault crown from 18.7 to 22.44. At that height-change revision the spirals used
40 treads over their previous footprint and turn, giving .186 nominal risers.
Books, furniture, globe, paintings, gallery guards and chandelier
bodies retain their local proportions and move at their mounting anchors.
Shelf bases/pitches, window profiles, roof envelopes, cables, floor shells and
walking collisions follow the new elevations. These are estimated model units.

All twelve ground arcade soffits now share 64 aligned nested elliptical
profiles with their timber rings and spandrels. The painted intrados stays
inside the timber backing across the whole arch, including oblique views.
The r10 GLB demonstrably fails the new ray regression (684 first-hit timber
rays); the final model is checked independently of the runtime materials.

All 28 double-sided catalog bookcases (56 faces, both floors) use a .78-deep
board: .12 shared back plus two .33 usable shelf cavities. Each .288-deep
rendered book has .024 back clearance and .018 front inset. Stiles, fluting,
base/crown profiles, plaques, placements and solid camera bounds follow this
depth. The upper dado trim stays below the lowest book rest plane.


All twelve side windows now have recessed stone reveals, connected twin-lancet
tracery, a continuous central mullion, one slim transom, thin diamond leadwork
and subtly varied pale glazing. Two additional glass materials raise the bank
to 28 after the r14 iron-gate removal; the existing 12 texture byte streams are preserved. The original
rectangular panes, floating rods and heavy repeated crossbars are removed.
`window_helpers.fragment` is required for a rebuild.

`20261019-outer-aisles-r15` is the source-generator revision for the expanded stair landings and the
A-end art exhibition wall and widened end crosswalks. Four distinct framed
paintings replace the scenery bookcases, and the two obstructing bronze statues
are omitted. The original central reader portrait is retained. Both ends move outward by 2 m, producing a 34.8×40
envelope with nominal end walls at `z=±20`. The central six bays and both spiral
stair anchors remain fixed. Dimensions are estimated model units, not surveyed
dimensions from the reference.

r15 adds continuous window-side outer aisles on both floors and both sides.
Each outer wall/window assembly moves outward by 2.4 model units; the gallery
slabs, ground pavers, end walls and side roofs extend with it. Shelf widths,
book scale, inner passages and stair anchors stay fixed. The four outer aisles
join both end crosswalks and retain a standing-body collision envelope.
`verify_outer_aisles.py` checks actual exported geometry and collision shells,
including a continuous 2 m-wide standing-height band, body-footprint floor
support and roof coverage across every side-vault seam. A negative control
with the old narrow geometry and the current config is rejected.

r14 removes the four ground-floor iron gates and their four collision shells, so
the ground arcade reads as continuously open. The stair handrails and the upper
gallery safety guards are untouched. The r15 editable source and all thirteen
runtime GLBs have been regenerated.
Source SHA-256: `561a319c1a6b963b38729b3b75ae7eff0f27f10fa8fc72399aced8c470077eb4`.
Config SHA-256: `49892f9e596c2e938add2f46875b50477eb2abb5db5b90f3c61a6f9bfe0ee0b1`.
The exported source contains 1,335,213 triangles. Exact ordered triangle-attribute
multiset preservation passes across the runtime modules. The 11 prior image streams remain byte-identical. The gallery adds one original
four-painting atlas and replaces the unused bronze material with a canvas material.

- Upper case interval: 11.10–14.58 (mirrored on the left), width 3.48
- Upper passage center: ±10.1125; narrowest measured door width 1.805
- Lowest front/back doorway tracery headroom: 3.66 above the 7.44 gallery floor
- Ground and stair walking eye height is a separate runtime contract
- Scene configuration: 1,112 descriptors resolving to 1,188 runtime architecture
  colliders, including 76 local-height helical arcs
- Both upper resting zones now span 3.05 × 2.4 model units, expanded toward
  the outer gallery. The new tongue is flush with the 7.44 floor and joins the
  existing crosswalk at z=-15.6 without overlapping coplanar floor faces.
  The outer return is moved to the exposed aperture boundary at z=-14; the
  inner terminal and connected helical handrail remain. The two stair-corner scholar niches are omitted so their figures cannot
  protrude through the new floor. The structural piers remain solid.
- Both routes begin on clear ground at (±6.64,0,-14.55)
- Upper crosswalk floor: `z=±15.6…±20.0`, depth 4.4; central width 17.6 and
  seamless side-gallery joins at `x=±8.8`
- End A moves to `z=-20`, End B to `z=+20`; their wall assemblies and trim move by 2 m. The B gallery screen moves another 0.5 m toward its wall
- End B's balcony, inner rail and support colliders retain their original
  projection in the `11_End_B_Balcony` authoring collection; the extended
  crosswalk floor joins them without deleting collision, and the exporter keeps
  all of that geometry in the runtime `b-end` spatial module
- `verify_crosswalk.py` requires a continuous 2.0 m body-clear band across
  `x=-10.1…10.1` after inflating every collider by the 0.3 m body radius, plus
  full-width floor, end-wall fronts at `±20`, and side-gallery floor connectivity
- No small shelf-front lecterns or upper desk/chair/lamp sets remain, and no
  orphan colliders remain. The three central long tables and six benches stay
- A-end upper cornices stop around the portrait bay; B-end blind panels clear
  the backing register and lower cornice

Measured crosswalk physical clear widths are 3.30 m at A and 2.80 m at B.
After accounting for the 0.30 m body radius on both sides, a continuous central
walking band of 2.70 m / 2.20 m remains across `x=-10.1…10.1`.
See `docs/verification/reference-library-*.json` for current source hashes,
module bounds and triangle equivalence.

## Current shelf and wall-side passage contract (r20)

`20261019-wide-shelves-r20` expands the hall to 40×40 model units. Lower
bookcase faces span x=9.45…16.0 (6.55 wide, +32%); upper faces span
11.10…16.18 (5.08 wide, +46%), mirrored on the left. Stiles are 0.24,
backs 0.16 and shelf boards 0.168 thick. The double-sided cabinet is 0.82
deep. Real book size, six rows and twenty slots per row remain unchanged.

All four wall-side aisles have a continuous 3.0-wide standing-height clear
band at |x|=16.5…19.5, with floor support and roof enclosure. Walls, windows,
slabs, pavers, end-wall spans and side-vault details extend together.
The old inner door minimum of 1.805 is preserved by rebating upper inner
stiles and plinths into the cabinet. Both end crosswalks and stair anchors
remain. Dimensions in earlier revision descriptions below are historical.

The final source and all thirteen runtime modules are checked by the source,
walk-clearance, outer-aisle and exact-preservation verifiers. See
`docs/verification/reference-library-2026-10-19.md` for r20 evidence and limits.

## Browser lighting (r21)

The runtime uses equal diffuse sky from all twelve window openings, aimed
inward. Warm light remains anchored to the three central chandeliers; the
middle fixture casts local shadows. The former strong indoor directional sun
is removed. `browser_lighting.py` reproduces the same browser-only contract
used by the generator and current `scene-config.json`.

Window RectAreaLights use the Three.js LTC uniforms. They approximate overcast
diffuse daylight without ray-traced or baked occlusion; local chandelier shadows
are separate. There is no claim of physical global illumination or measured
illuminance. Geometry/modules remain r20. The lighting-only hash bridge is
`docs/verification/reference-library-lighting-r21.json`; earlier geometry reports
retain their original r20 config hashes.

## Catalog bindings (r22)

Runtime catalog volumes keep their original front-cover images. Thin boards,
curved printed spines, fine correctly oriented shared paper/linen maps and
cover-derived stock colors replace the former uniform heavy binding. All real
IDs remain one-to-one; no filler books or generated cover assets are added.
Visual height/thickness estimates vary deterministically inside the old
reservation while the .288 shelf depth and tail support stay fixed. These are
not edition measurements. Book geometry/materials live in virtual-library-scene.ts
and catalog-book-appearance.ts / catalog-book-surfaces.ts, independently of the
unchanged r20 architectural modules and r21 lighting.

## Left storey windows (r23)

Six real lower-left openings join the existing six upper-left windows.
The six upper-right windows remain. Ground sill/spring/crown are
1.08/5.08/6.12; opaque sill/head/pier/end wall bands and the solid outer
camera barrier remain. The generated storey metadata drives18 matching
diffuse sources. verify_storey_windows.py checks clear-pane rays and head
sealing on all18 openings, and rejects the old opaque lower wall with an
optional --baseline source. Geometry/modules/cache namespace are r23.

## Runtime package

`20261019-gallery-pilasters-r19` removes the two obsolete sculpture-niche
backboards, pointed stiles and rosettes that overlapped the A-end exhibition
pilasters. All six fluted structural columns, their cornice connections and
the five exhibition artworks remain. This is a local upper-wall correction;
the r18 end structures and existing circulation layout are retained.

- 13 bounded spatial/semantic GLBs in `apps/web/public/assets/hogwarts-library/modules/`
- `library-manifest.json` records exact bounds, counts, priority and hashes
- `materials.gltf` owns canonical materials, texture indices and samplers
- 12 PNG images are shared by content hash, without recompression
- `scene-config.json` is generated from the same architectural contract

Modules use `KHR_meshopt_compression`, bitstream v1, filter `NONE`, and the exact
`INDICES` codec. No float quantization, triangle rotation, decimation or texture
recompression is performed. Ordered corner attributes and material assignments
are preserved. The bundled Three.js decoder needs no runtime CDN.

## Editable source and rebuild

The recovery package contains `deliverables/library-source.blend` with all texture
images packed, plus `deliverables/architecture-uncompressed.glb`, scripts and the
original texture-name inputs required to rebuild. The Blender hierarchy remains
editable by architectural assembly. These authoring files are not web payloads.
The application repository plus the authoring recovery package form one revision.

Use Blender 4.3.2, Python with NumPy and pinned Node dependencies. Set `PYTHON`
to that interpreter for the module verifier (Blender bundles a suitable Python):

```sh
pnpm install --frozen-lockfile
blender --python-exit-code 1 -b -t 2 \
  --python scripts/hogwarts-library/build_library.py -- --stage full
"${PYTHON:-python3}" scripts/hogwarts-library/verify_glb.py
"${PYTHON:-python3}" scripts/hogwarts-library/verify_end_walls.py
"${PYTHON:-python3}" scripts/hogwarts-library/verify_crosswalk.py
node scripts/hogwarts-library/export_modules.mjs
node scripts/hogwarts-library/verify_modules.mjs
blender --python-exit-code 1 -b \
  --python scripts/hogwarts-library/verify_walk_clearance.py
```

`walk_clearance_colliders.fragment` supplies bounded shells following actual
carved openings, arcade shoulders and suspension wires. Do not replace these with
full-height cylinders or oversized solid doorway barriers. The exporter validates
its triangle count against the current source instead of a stale fixed revision.

The build resolves the stable `r2-*` material names through the tracked
`materials.gltf` image table and reuses the 11 approved hashed PNG files. Do not
run `material_maps.py` merely to rebuild the architecture.

The portrait input and `PORTRAIT-NOTICE.md` remain with the package. No game mesh,
extracted texture, screenshot plane, logo or NPC is included. All visible live
shelf books must continue to map one-to-one to the authorized catalog.

## Verification and performance boundaries

`verify_walk_clearance.py` reimports the exported source GLB and checks all 14 upper
openings, 84 six-row case samples on both book faces, wall/cornice gaps, supported
aperture guards, flush stair exits and route head clearance. The exact-triangle
proof binds these geometry measurements to the 13 delivered modules. Runtime
body-envelope and actual-book tests are owned by the web test suite.

`verify_crosswalk.py` samples the actual uncompressed GLB floor at both ends
across the central and side-gallery widths, checks the extended roof and end-wall
surfaces, intersects the body-inflated collider intervals over all central x
samples to prove a 2 m common walking band, floods that central route for
full-width connectivity, and walks the gallery-floor collider graph from each
crosswalk into both side corridors.

Fixed-camera before/after images are offline Blender renders of actual exported
geometry. They do not prove browser navigation, GPU frame rate or interaction.
The latest eight user reference views informed spatial relationships; the model
still differs in exact pointed tracery, end-wall carvings and
other reference-specific details. This is not a claim of complete reproduction.

Native multi-draw uses material batches with per-object culling. Unsupported
browsers consolidate resident geometry by material. Static shadows are refreshed
when geometry changes. Browser/GPU acceptance requires an actual supported
browser; CPU counts and Blender renders are separate evidence.

`verify_arcade_soffits.py` samples all twelve exported soffits from both sides and oblique angles; reports bind their final source SHA and config revision.

`verify_rigid_features.py --baseline <prior-uncompressed.glb>` compares actual GLB spatial samples of proportion-preserved objects before and after the height change. The default baseline is the local r10 snapshot; provide an archived source GLB to reproduce elsewhere.

`verify_roof_enclosure.py` checks all four solid exterior-wall end bands, the
curvature of all four exhibition end vaults (rejecting the former flat blue
slabs), and opaque coverage along both main/side-vault junctions. End vaults
have a longitudinal half-width of 2.5, a spring at 14.58 and a rise of 2.94.
Their camera ceiling envelope and the narrow timber transition are shared
with the runtime layout contract. The report binds source/config SHA-256.

`verify_end_arcade.py` checks the A-end ground arcade's bay-centered picture
frames in frontal and oblique views, complete spandrel support up to the gallery
underside, and open ground apertures. Keep the low wainscot below the frames;
checking only the frame's bounding box would miss a panel protruding into its
canvas. Runtime body tests separately cover open passages, solid arch heads and
rear picture surfaces.

The B-end balcony now has two complete support arches between its three piers,
with solid heads meeting the floor underside. The former pointed outlines
centered on each pier are omitted. Both lower wheel panels have solid backing
attached to the rear wall, connected hubs and actual-depth collision bounds.
`verify_end_b_support.py` measures the exported support heads, clear lower
apertures and rear-panel depth; retain the balcony footprint and crosswalk.

R31 verification: exported screen-region triangles decrease from 12,560 to zero; balcony, rear wall and paired stair probe geometry matches the prior GLB exactly. All 13 streamed modules preserve source triangles and textures. The 82 focused tests, lint, typecheck and build pass. Live browser inspection shows the open upper wall with no captured console warnings or errors; screenshot: `.local/logs/upper-balcony-r31-browser.png`. Full-suite tests, Git commit, push and deployment were not performed for this change.
