# Reconstruction completion audit

Rechecked 2026-09-10 against current source, the latest local verification logs and the public architectural-history page. **Incomplete.** Passing compilation and circulation tests does not establish a measured facsimile.

The persistent objective remains a 1:1 reconstruction. Later user instructions explicitly require a larger/wider hall, lower cabinets, removal of repeated rough statues and central tables, usable circulation and real catalog zones. The active model implements those adaptations; this audit does not redefine that adapted experience as literal 1:1.

| Requirement | Current evidence | Finding / evidence still needed |
| --- | --- | --- |
| Longitudinal two-level Long Room | `buildLongRoomProgressively`, continuous barrel and separate side vaults | Implemented locally; exact section still estimated |
| Published envelope | College architectural-history page rechecked: 63.7 × 12.2 × 14.2 m; separately retained in layout | Published source dimensions confirmed, not a new survey |
| Active dimensions | `longRoomLayout.ts`: 90 × 22.3 × 18.45 m; 2007 m² rectangular area | User adaptation; contradicts a claim of literal measured 1:1 |
| Lower cases and category zones | 5.4 m cases; 10 usable rows now reflected in metadata; 120 slots per case; real category focus | Local flow implemented; final 10-row focus recheck recorded in reference log |
| Windows, floor, ceiling and light | Physical sash apertures, lower fabric blinds, procedural timber surfaces, moulded barrel ribs and modeled lamps; estimated west ceiling rococo layout | Implemented estimates; no measured window/joinery sections, calibrated materials or physical daylight validation |
| Gallery and stairs | Adapted access stair, landings, continuous two-side galleries and crosswalk; modeled historic spiral and central exit | Complete two-way adapted route tested; original pavilion circulation is not reproduced in full; spiral not directly climbable |
| Gallery joinery | Framed newels, curved balusters, modillions, dentils, rounded beads | Near-view reviewed; exact profiles/repetition remain photo estimates |
| East/west terminations | Separate doorway/niche geometry, west pediment and east vestibule/screen; estimated west stair/enclosure now joined to the live hall with guided down/up travel | Official existing-condition sheet Y1.002, application 2949/20, now identifies Henry Jones Room (49 m²) south of the west landing, grand stair north, and Fagel (55 m²) at the east/south. Three submitted plan sheets were visually inspected. The south-side Henry Jones shell and guided landing doorway are now implemented and traversed locally in both directions. Interior furnishings, precise door/partition dimensions, upper service spaces and east pavilion remain incomplete. Historical proposal contains unexecuted handrail changes |
| Sculpture and central furniture | No live busts, central display tables or harp cabinet; Swift/Shakespeare component studies only | Removal follows later feedback. Distinct likenesses and full historical furnishing fidelity remain absent; do not restore generic duplicates |
| Inscriptions and historic addresses | Benefactor-name plaques removed from the live hall per user direction; a-i/aa-ii shelf marks; QQ/RR lectern study | Published benefactor names remain source evidence only; full stall sequence and absolute plaque/lectern locations remain unresolved |
| Real catalog and camera collision | Four real books checked; focus frame fits; 504 collision descriptors in the latest high-window main-route check; route sweep before/after batching | Implemented locally, not proof of large-catalog capacity or every camera angle |
| Rendering responsiveness | On-change rendering, staged construction/cancellation, static batching, spatial binding LOD | Implemented; residual long tasks and millions of visible triangles remain. No controlled GPU/FPS acceptance benchmark |
| Model/reference comparison | Component and entrance reviews, actual ascent to second gallery | Not a complete matched-camera comparison of all architectural surfaces or sculptures |
| Verification scope | Full frontend suite: 91 files / 275 tests passed; lint, typecheck and production build also passed on 2026-09-10 | Browser still retains the known Ant Design Drawer `width` deprecation warning; architectural fidelity, mobile behavior and controlled GPU/FPS measurements remain incomplete |

## Current parameter authority

`public-reference-data.json.parameters` contains the published physical dimensions and early source-scale candidates. `runtimeSnapshot` describes current source parameters. Do not use old candidates to override the active layout. `enlargedExperience` area and ratios and `windowConstruction` have been corrected; the public notes no longer claim the old 18.3 m width or 20.4 m height.

## Next evidence that matters

- Establish exact original section and joinery dimensions through measured drawings or defensible matched-camera reconstruction; keep active user adaptations explicit.
- Complete east/west pavilion geometry and validate circulation against actual source plans rather than the adapted access route.
- Resolve complete historic lettering and stall sequence independently of the bust register.
- Obtain or construct acceptable individual portrait likenesses only as studies while live removal remains authoritative.
- Capture comparable performance measurements and broaden catalog/camera interaction coverage before claiming a finished experience.

## Reference availability audit

- Workspace model inventory contains only the older lamp, chandelier and armchair assets; no Long Room scan, measured building model or portrait dataset is present.
- V-SENSE describes an actual manual-model/photogrammetry reconstruction at https://v-sense.scss.tcd.ie/creative-experiments/jonathan-swift-in-vr-ar-long-room-project/ . The current discovery evidence establishes that the project exists, not a usable downloadable asset. Direct page access timed out during this audit.
- Tir 3D advertises the Long Room laser survey at https://www.tir3d.ie/about-us-tir-3d/projects/trinity-hall-laser-scan/ . No deliverable or reuse permission has been obtained; direct page access timed out during this audit.
- The discoverable rafapages Long Room Sketchfab entry has no exposed download control in the retrieved listing. No model data has been extracted.

## Current continuation route

The user explicitly authorized assembling reconstruction data from public sources on 2026-09-09. A complete scan is no longer a prerequisite for continuing. Use `public-reference-data.json` and `public-data-notes.md`: published dimensions, date-consistent sculpture locations, observed stair forms and clearly marked working estimates. The reconstruction remains incomplete; missing exact dimensions are adjustable assumptions rather than a reason to stop public-source reconstruction.

### Reference-access recheck

A subsequent direct request successfully retrieved the Tir 3D project page (HTTP 200). Its published deliverables are approximately 1000 scans, a registered point cloud, an LOD300 Revit model and sectional/elevation drawings supplied to its client. Inspection of the page's links found no downloadable survey/model deliverable. This removes the earlier page-access uncertainty but does not provide the missing reconstruction data. V-SENSE direct access also failed after an HTTP/1.1 retry. No new user-provided reference has arrived. An unsent access-request draft is saved beside this audit. This earlier scan-access limitation does not block the subsequently authorized public-photo reconstruction route.

Latest proportion review: reduced lower cabinets to 5.4 m, widened central aisle to 14.2 m, gallery at 5.95 m. Central and side vaults now distinct. These requested adaptations further rule out describing the active envelope as literal measured 1:1. Distinct sculptures remain unfinished as studies. Live removal follows the later user instruction and must not be undone with generic duplicates. Historical furnishing fidelity remains incomplete.

## New pavilion topology evidence

See [pavilion-plan-evidence.md](pavilion-plan-evidence.md) for inspected video timestamps and limits. The stair-plus-adjacent-room arrangement is now supported by a visible plan slide, but no new metric placement is established. The code already offsets the stair enclosure laterally; the missing adjacent room is the concrete current gap.

West-room follow-up: a 2015 thesis independently corroborates stair/Long Room doorway adjacency, and a 2012 firsthand Henry Jones Room account provides a photographed memorial wall. Neither identifies room 9 on the 2021 plan. See pavilion-plan-evidence.md. Room identity, doorway location and precise pavilion geometry remain unproven; no new volume was placed from names alone.

Official-plan update: the earlier room-9/current-west-room identity and compass gap is now resolved for the submitted 2019/2020 existing-condition state by Y1.002. See pavilion-plan-evidence.md and dcc-existing-plan-manifest.json. The adjacent Henry Jones shell has since been added with a supported doorway and guided access, verified in both directions. It remains an adapted, unfurnished enclosure; this is not architectural completion.

### East Fagel room update
The former scaled side-shelf placeholder has been replaced by a separate Fagel room and circulation envelope using Y1.002 topology. Room-internal support/collision test passes, and the four main Long Room tests pass after updating the renamed circulation geometry checks. The local `component=fagel` view was visually reviewed with no browser console errors. This does not prove east-pavilion completion: entry from the main hall remains blocked, the northern stair/lift area is missing, and measured case details, labels and door leaves are not reconstructed. Main catalog book behavior and the enlarged-hall adaptation remain in place.

#### Fagel entry and return verified
The main-hall Fagel entry is now connected. Browser checkpoints at route distances 0, 8 and 14.4 m were clear. After the build reload, an 8 m excursion was reversed to 0 m and the Return to Long Room button cleared the route at (0,1.65,43.5). The final two-column destination controls were visually inspected with no horizontal document overflow. Five focused model tests, lint, typecheck and the final build passed. Earlier blocked-entry/pending-return notes are superseded by this verification; northern east-pavilion stairs and detailed room fidelity are still incomplete.

### East stair integration
The east stair component is now attached to the live pavilion root via `longRoomEastEnclosure.ts`. The first-floor circulation north wall is split around a 1.7 × 2.35 m upper opening at local z7.4, meeting the existing upper arrival slab. North/east window walls enclose both levels, and the ground arrival has a slab at −4.58 m and a lower opening at z3.8. These are adapted offsets and window sizes, not surveyed dimensions. The adjoining lower exhibition remains an unfinished enclosed shell, and the separate service core is absent.

The expanded stair test builds the actual Fagel/enclosure hierarchy and samples both travel directions through the upper threshold, two flights, curved landing and lower threshold. Floor support and collision checks passed. The integrated `component=east-enclosure` entrance view was visually inspected. The main user interface does not yet expose an east descent route; live geometric integration is not a completed navigation claim.

### East descent browser verification status
The main route reached its 27.40 m lower endpoint at eye (−1.202,−2.930,48.800), with collision clear. Reverse travel passed the curved landing and reached the upper level at distance 8.96 m, eye (−0.061,1.650,52.400), also clear. Repeated browser-control timeouts prevented confirmation of distance zero and the final exit; neither is claimed as passed. The two focused route/support/collision tests, lint, typecheck and build passed earlier in this verification sequence. The lower arrival remains an unfurnished shell. An uncontrolled live load reported worldBuildMs 252435; performance is still unfinished. This supersedes the earlier missing-route implementation note, not the remaining fidelity gaps.

### East service-core evidence and pavilion sash refinement
Visually reviewed the complete XS-4A and XS-4B sheets (pages 27 and 28 of `old-library-survey-report.pdf`, Murphy Surveys, 20 December 2019, DCC received 30 June 2020). They show a narrow multi-level stair beside the large pavilion rooms, with closely spaced landings and vertical guards; it is distinct from the ground-to-first solid-parapet return stair on XS-3A/3B. The service core is still absent from the model. These sections establish topology, not extracted metric dimensions or an approved live placement.

Pavilion windows now have two depth-offset sash leaves and profiled, bevelled rails and glazing bars. The former hard-coded meeting rail at row two is replaced by the leaf split: two/three rows for the western five-row window and three/three for the eastern six-row window. Window openings and glass collision are retained. Profile widths and depth offsets remain reconstruction estimates; this is not measured joinery. The dedicated `component=pavilion-sash` oblique browser view was visually inspected. Existing window-opening/glazing-collision and both east stair support/collision tests pass (2 files, 3 tests). Full-hall visual completion and service-core reconstruction are still pending.

Pavilion sash final checks: `pnpm lint && pnpm typecheck && pnpm build` completed with exit 0. Vite retained its large-chunk warning; this does not establish performance completion. No full frontend-suite pass is claimed.

### East service stair study
The Y1.002/003 plan places the small winding stair beside the lift in the northwestern part of the east pavilion; the large solid-parapet return is east of it. XS-4A/B shows the independent stair continuing across the upper storeys. A dedicated `longRoomEastServiceStair.ts` component now reconstructs this distinct topology with relative floor levels −4.58, 0, 5.49, 8.89 and 12.42 m from Y2.001. Width 0.86 m, centerline radius 0.7 m, straight run 2.7 m, eight winders per rise, riser count and profile sizes remain estimates. Do not describe them as surveyed measurements.

The component has closed risers, curved winding treads, continuous side stringers, round handrails and instanced vertical metal balusters. Curved guard collision is subdivided using each side's own radius; an initial over-broad inner-turn collider was found and corrected. The focused test verifies walking samples in both directions, support, standing headroom and lateral guard blocking. The `component=east-service-stair` browser overview was visually checked after the correction. This is a review component, not a connected live stair: the pavilion upper rooms, floor openings, service enclosure and lift remain unfinished.

Service stair final verification: focused test passed (1 file, 1 test); browser component error logs empty; `pnpm lint && pnpm typecheck && pnpm build` exited 0. Existing large-chunk warning remains. The full frontend suite was not rerun and the main pavilion integration is not complete.

### User-requested stair and basement correction
Removed the freestanding long timber access stair and its landing; reinstated the upper gallery rail and posts at its former connection. The guided gallery route now follows the photo-derived iron alcove spiral, through its top landing and along the gallery. Replaced its blocking whole-cylinder collider with a center-post collider and segmented outer guards. Entry/exit guard sectors are open for passage; profile, dimensions and these access adaptations remain estimates. The upper end crosswalk still remains an adaptation.

The user then requested removal of the basement. Removed the central descending visitor stair, its lower platform, light and blocking volume. A continuous, consistently mapped timber floor closes the central opening. This is an explicit user-directed departure from the visitor-guide source, not a claim that the source has no descending stair. Ground-level east/west pavilion circulation is distinct from this removed central basement entrance.

Final browser ascent reached route distance 12.00 m, floor 2, eye Y7.600 and collision clear; reverse returned to distance 0.00 m, floor 1, eye Y1.650 and clear. Exit left walking mode. The 2 focused model files / 5 tests pass, covering route collision after batching, physical floor support and absence of the removed stairs. A 60000 ms test timeout was used for the loaded host; this is not a performance pass. Overall 1:1 fidelity remains unfinished.

Final checks for the stair/basement correction: lint, typecheck and build exited 0. Browser logs contain the existing Ant Design Drawer width deprecation warning; no zero-console-error claim.

### Main-hall window resource reuse
Full window details are now constructed once per side within each scene build, then cloned into the twenty bay positions. Existing shared sashes and reveals are retained; round architrave beads, blind folds, rollers, sill/head joinery and catches now also share geometry. No cross-build cache is used, so disposed geometry/material sets cannot leak into later scenes.

The before/after probe of 1,480 named detail meshes recorded 1,480 distinct geometries before and 74 after. Per-mesh names, six-decimal world bounding boxes, vertex counts and index counts matched exactly. See `window-detail-reuse-verification.json`. Single build samples were approximately 4.34 s and 3.10 s under uncontrolled host load; these are not a controlled TTI benchmark or a general performance claim. The temporary comparison test passed and was removed after recording its result; the permanent Long Room test verifies twenty correctly positioned windows on each side and shared geometry/material identities. All four Long Room tests pass. The main overview was visually inspected after reload; central floor remains continuous. Architectural completion and overall loading performance remain unfinished.

Window reuse final checks: lint, typecheck and build exited 0; existing Vite large-chunk warning remains. Main browser logs show the existing Ant Design Drawer width deprecation warning. No full-suite or overall performance completion claim.

### Spiral top-aperture guard correction
The visible perimeter around the iron spiral's gallery opening lacked collision. Five collider segments now follow those guard lines, preserving the central outlet. Outlet and landing width are aligned at 0.9 m so adding guard collision does not close the passage for the existing 0.3 m camera clearance. The opening uprights now use a shared round cylinder section and a lower rail. These dimensions and details remain adapted estimates.

The Long Room test now explicitly checks blocked crossings at all five perimeter segments and a clear crossing through the outlet; the full forward/reverse guided route and physical support checks also pass (4 tests). Browser and final build status follow separately. Overall fidelity is not complete.

Opening-guard final verification: lint, typecheck and build exited 0. After the build-triggered page reload, browser ascent reached distance 12.00/floor 2/eye Y7.600 with collision clear; reverse reached 0.00/floor 1/eye Y1.650 with collision clear, then exited walking mode. The stair-opening close view was visually inspected and retained. No full-suite or 1:1 completion claim.

### East upper pavilion room
Added `longRoomEastUpperRoom.ts` to the live east pavilion hierarchy above Fagel. Y1.003 labels this room Early Printed Books, 112 m², FFL +10070. Relative to first floor +4580 the modeled floor is +5.49 m. The adapted envelope x−9.33..9.33, z0.5..8.5 and estimated ceiling +8.54 are not surveyed interior dimensions; slab area excluding the reserved core is approximately 133.638 m², not the source's 112 m². The difference remains part of the requested enlarged experience.

The room has a continuous mapped timber floor around a real service-core opening, a ceiling, a west doorway/threshold and separate window apertures with glazing collision. The reserved stair/lift footprint is temporarily enclosed by full-height walls until the core is connected. Window sizes, pane counts, joinery and lighting remain estimates. The room is unfurnished and has no live guided entry yet. The upper-room/Fagel/east-stair tests pass (3 files, 4 tests), covering floor support, guarded core, open internal doorway, glazing collision and preservation of lower circulation. The upper-room browser view was visually inspected. This is progress on the missing volume, not a completed pavilion or 1:1 claim.

East upper-room final checks: lint, typecheck and build exited 0; component browser error logs empty. Existing Vite large-chunk warning remains. The new upper room is present in the live hierarchy but has no main-route entrance yet; no full-suite or architectural completion claim.


### East upper doorway through the main end wall

Rechecked the existing Y1.003 east upper plan crop: the Early Printed Books room has a west-facing doorway near the axial circulation line. The main hall end wall now has a matching opening, split collision head/jamb volumes, and interrupted cornice segments instead of a solid wall in front of the previously modeled room door. Both wall layers share the estimated 1.6 × 2.35 m opening and the +5.49 m source-relative floor datum. Timber reveals and a soffit line the adapted 0.5 m gap between the two walls.

Focused coverage checks visual rays at low sill/cornice and eye heights, both-direction eye sweeps, solid jambs, and the existing east lower stair route. The isolated east-upper-portal browser preview confirms visibility into the upper room. This is not a completed gallery connection: the +5.95 m gallery still needs a supported transition to +5.49 m and source-calibrated end circulation. No upper-room guided route has been enabled. Door dimensions, wall thickness and cornice treatment remain estimates.


### East gallery transition and upper-room circulation

Added an east end crosswalk at z42.5..43.9, connected through matching openings in both gallery rails. A central 1.6 m wide, three-tread transition descends the adapted gallery +5.95 m to the source-relative upper-room +5.49 m; each going is 0.35 m with a 0.01 m tread nosing. Turned balusters guard the bridge and solid side panels guard the treads. These circulation dimensions and new joinery are estimated adaptations, not surveyed original details.

The existing gallery guided route now continues from the spiral, around the west crossing and along the opposite gallery, across this platform and into Early Printed Books (terminal x0, y5.49, z49). Floor labels use the upper room datum so the transition does not incorrectly display the first floor. Tests check the complete model route before/after static batching, physical support, transition headroom, reverse traversal and exposed platform edges. Browser walk verification is recorded separately below when available. Historical fitting dimensions, exact east-end joinery, service core and full architectural fidelity remain incomplete.

Verification: Live /virtual-library: followed gallery route to d208.39, x0,y7.140,z48.998, floor2, collision clear; reversed 16 m to d192.40,x6.55,y7.600,z39.648, floor2, collision clear; exited walking mode with position preserved. Current error log query returned []. This verifies the new doorway/transition both directions; full reverse down the spiral was not repeated in this run.

Full Long Room: 4 tests passed with CLI timeout 120000 after a prior 15-second timeout under host load; rerun total 14.22 seconds. New transition test passed. East stair, Fagel and upper-room tests: 5 passed. lint, typecheck and build passed; Vite large-chunk warning persists.


### East upper reading furniture from the 2017 reference photograph

The University Times, “Explore a Different Side of Trinity with Early Printed Books” (19 April 2017), identifies the east pavilion reading room and describes protective book cradles. Its photograph by Anna Moran visibly shows timber reading tables, grey desktop mats, dark green seats and paired wedge-shaped supports. Sources: https://universitytimes.ie/2017/04/explore-a-different-side-of-trinity-with-early-printed-books/ and https://universitytimes.ie/wp-content/uploads/2017/04/EarlyPrintedBooksSmall.jpg . The remote photograph was inspected in the browser and is not shipped as a product asset.

Added original procedural furniture in the south fitting zone indicated in Y1.003: four estimated table rows, two reading places each, rounded tabletops and seats, tubular chair frames, protective mats and paired foam supports. Table dimensions (0.9 × 3.4 × 0.76 m), four-row interpretation, chair details and placements are estimates, not measurements from the photograph. Main-hall furniture remains removed. The room's central entry and east-side aisle stay clear. Table/chair eye-height collision proxies prevent the standing camera from passing through low furniture; anonymous empty supports do not create or duplicate catalog books.

Remaining: exact furniture inventory, shelving and lighting, source-aligned materials, service core and wider architectural fidelity. The official library says research collections have moved temporarily to Ussher during redevelopment; this furniture reconstructs the historical Old Library photograph, not the current interim study centre (https://www.tcd.ie/library/research-collections/reference-collection.php).

Verification: Reading furniture/upper room/east gallery/full Long Room: 4 files, 8 tests passed with CLI testTimeout=120000. lint/typecheck/build passed after preserving concrete geometry types in the mesh helper. Browser reading-furniture view visually checked; current error logs empty. Vite large-chunk warning remains. Full main-route browser traversal was not repeated for this furniture-only addition.


### Independent east service stair: first-to-second connection

Rechecked Y1.002 first-floor east plan: a separate side door from the Long Room reaches the small stair beside the lift, distinct from the central entrance and larger U stair. The live pavilion now includes only the 0 to +5.49 m flight (source absolute FFL +4580 to +10070). The other service-storey flights remain in the isolated study. No basement access was reinstated.

Added a 1.05 × 2.35 m estimated side opening centered at x−6.9 in the main end wall and the inner west enclosure. Split the lower ceiling around the reserved core footprint, opened the upper core enclosure at its landing, and added thresholds and lower walls. The lift footprint remains a solid reserved volume. The new service route uses the stair builder's tread samples, preserving the geometry/path relationship; it is available through the service-stair shortcut and exits walking mode at the current position.

This reconstructs the surveyed connection topology with estimated plan dimensions, wall thickness, riser subdivision and joinery. Operational lift, service levels above the reading room, exact source dimensions and lighting remain unfinished.

Verification: service core and standalone stair 2 tests passed; east/core/upper/gallery/full-model 10 tests passed. Final full-model rerun includes the service route after mesh batching and passed 4 tests. lint/typecheck/build passed; large-chunk warning remains. Browser service route: length17.04; ascent d17.03,x-6.900,y7.140,z49.498,floor2,collision clear. Reverse d0.00,x-6.900,y1.650,z44.202,floor1,collision clear. Exited service walking with route dataset cleared and position preserved. Stair interior and upper room were visually inspected. Error log shows the existing Ant Design Drawer width deprecation; no zero-console-error claim.


### Consistent fine-oak finish and metric end-wall mapping

Inspection found two inconsistent timber paths: the main hall loaded the legacy walnut-texture.png while isolated components used a Canvas texture with a strong crosswise brightness gradient. The historic-oak material factory now reuses the existing procedural fine-oak finish (formerly scoped to west stair joinery), with shared albedo, relief and green-channel roughness maps and separate trim/dark material factors. Main-hall roughness is higher than the polished west staircase. The main builder no longer requests the walnut image, and review components use the same historic-oak factory. The walnut asset remains available to unrelated callers.

End-wall ShapeGeometry now uses the same local metric grain projection as joinery (0.6 m across / 2.8 m along), retaining all openings and vertex positions. Floor and barrel-lining board maps remain separate. The common wood maps are 128 × 256, shared within each material set but not across independently disposable builds. Color, roughness and grain scale remain photographic estimates, not calibrated physical samples; this is not proof of measurement-level material fidelity.

Validation: 6 full-hall/upper-door tests and 2 material/UV tests passed. The complete hall and east upper portal previews were visually inspected; the complete-hall current error log query returned empty. First browser attempt found port 4175 stopped; lsof confirmed no listener, and the frontend was started on 127.0.0.1:4175 for component review. Main authenticated runtime was not retested in this material pass.

Final material pass: lint, typecheck and build passed after the roughness adjustment. Vite large-chunk warning remains.


### Main sash eased edges and metric timber mapping

The main hall sash builder still used sharp box sections and per-box default UVs, unlike the previously refined pavilion sashes. Main stiles, rails and glazing bars now use an eased closed extrusion with a 3 mm maximum bevel contained within the existing dimensions. Grain follows each member at the shared 0.6/2.8 m mapping scale. Each sash remains a single merged timber mesh; the two window-height templates remain shared throughout the hall. Pane count, glazing depths, meeting overlap, opening dimensions and the existing conservation blinds are unchanged. This is a photo-informed profile estimate, not measured historic joinery.

Verification: lint/typecheck/build passed; five sash/full-hall tests passed, including pane visibility and meeting-joint rays, room boundaries and the complete retained navigation routes. Standalone sash and main window previews were visually inspected. In the main lower window, the existing blind screens the joinery; direct profile inspection used the isolated sash. Fresh main-window console error query returned empty. No full-suite or overall 1:1 completion claim.


### Survey-supported side-arch proportion and intersecting vaults

Re-inspected the saved official Y2.001 existing-condition sheet (central longitudinal section, 2019/2020 application 2949/20) and Murphy Surveys cross-sections XS-6A and XS-7A. The longitudinal drawing shows near-semicircular upper side arches; the transverse drawings show their crowns above the central barrel spring. The former 0.48 m rise over the adapted 4.335 m bay was too shallow. The side profile now uses radius/rise = half the adapted bay pitch, 2.1675 m. This carries the observed proportion into the user-requested enlarged hall; it is not a surveyed metre dimension or a literal whole-building 1:1 claim.

The lateral ceilings extend inward to x = sqrt(R² - rise(z)²), meeting the central cylindrical barrel at the same sampled curve. The central barrel is trimmed to that curve; obsolete internal spandrel caps are removed, outer wall closures retained, and the seam bead follows the three-dimensional junction. This replaces the former disconnected shallow side ceilings. Main crown, hall width/length, lower case height and basement removal remain unchanged.

Validation: four full-hall tests passed, including new upward rays at and on both sides of the junction plus retained full gallery/service/Henry collision routes. Lint, typecheck and build passed. Isolated vault and complete hall previews visually inspected; fresh complete-hall console error query empty. Current component-review entrance sample: 186 draw calls, 6,407,682 rendered triangles. This is a snapshot with zero real catalog books, not a controlled before/after performance result or main-page FPS benchmark. The curved main shell has additional longitudinal subdivisions; no whole-scene speedup is claimed. Exact historic joinery profiles, material calibration and broader architectural fidelity remain incomplete.


### Survey-supported upper end elevations and west pediment level

Re-inspected Murphy Surveys XS-6A/XS-6B in old-library-cross-sections.pdf (pages 1/2). Both elevations show paired upper arched niches, shaped overpanels above those arches, four rectangular central upper panels and long vertical fields. XS-6B places the triangular door pediment on the upper level, not over the lower main-hall doorway. Added longRoomUpperEnd.ts for both ends and removed the misplaced lower west pediment. Upper niches are real openings in the end-wall mesh with 0.32 m recessed backs, jamb/arched reveals, sill and curved moulding. Upper east doorway remains open to the existing reading room; west upper door is a closed modeled leaf with panel fields and a triangular pediment. The empty niches preserve the user's removal of sculptures.

Composition follows the survey; niche centers ±3.25 m, radius 0.95 m, floor/crown heights and joinery sections are adapted estimates. The west upper room behind the closed door is not reconstructed or connected by this change. Large-hall proportions and basement removal are unchanged. The wall now has seven east openings and five west openings including the new niche pairs; collisions intentionally remain solid across niche fronts.

Verification: six full-hall/upper-room tests passed, including rays to recessed upper niche backs on both ends, corrected upper pediment level, the unobstructed east upper door, and existing complete retained navigation routes. Lint/typecheck/build passed. Both upper-end preview cameras were visually inspected. A smooth spline initially distorted the straight overpanel edges; it was replaced by a line-and-arc-sample perimeter and rechecked in the final west view. Fresh west upper-end console error query empty. This is not a full matched-camera or measured 1:1 completion claim.


### West end balustrade consistency and supported turned members

Replaced the western crosswalk's square stick balusters with the existing photograph-derived turned gallery profile, consistent with the end balustrade visible in XS-6B and the adjacent galleries. Both western runs share one InstancedMesh (130 members), a supporting lower rail, matching handrail dimensions and two lower entablature layers. Added floor collision to the existing crosswalk slab and matched the guard proxy depth to the 0.24 m visible handrail. Bridge width/depth and route locations remain adapted estimates.

The shared placement now fits all longitudinal, eastern and western turned gallery members between the lower rail top (+0.17 m) and handrail underside (+0.985 m). This removes the previous 10 mm bottom and 25 mm top air gaps without changing the isolated original-profile geometry. Profiles/spacing remain estimated, not a measured historic joinery section.

Validation: five full-hall/east-gallery tests passed, including western member support-height bounds and complete retained routes after batching. Lint/typecheck/build passed. The final upper-west-end browser view shows the turned balustrade and layered base; fresh console error query empty. No main-route end-to-end browser traversal or performance speedup is claimed in this pass. Whole 1:1 reconstruction remains incomplete.


### Henry Jones memorial evidence and isolated frame study

Reopened Patrick Comerford's firsthand 19 October 2012 account and inspected its first photograph (DSCN9262) in the browser. The original monument has an approximately square brass plate, a broad sloping mitred timber frame, a narrow outer rim and an inner bead. The source distinguishes this older monument from the modern plaque below it. The 1891 Book of Trinity College independently calls Jones's 1651 memorial a brass plate. Sources: https://www.patrickcomerford.com/2012/10/memories-of-old-bishop-and-old-book-in.html and https://www.gutenberg.org/cache/epub/61000/pg61000-images.html . No remote photo is packaged as a texture.

Added longRoomHenryMemorial.ts and component=henry-memorial: four mitred sloping frame faces, inner/outer profile transitions, solid backing and an inset brass plate. The study uses a provisional 1 m outer square and 0.66 m inner aperture to express photographed proportions, not measured dimensions. The weathered Latin, heraldic detail, patina and room-wall placement remain unresolved and are explicitly absent. The blank study has not been installed in the live Henry Jones room; it is not a completed plaque reconstruction.

Validation: lint/typecheck/build passed; component preview visually inspected and fresh console error query empty. No tests added for this isolated reversible geometry. The next evidence needed is an authoritative inscription transcription and a room view establishing location; neither was found in the inspected sources. This does not block other architectural work or establish completion of the whole goal.

### Henry Jones paired plaques integrated above the adapted doorway — 2026-09-10

The public Henry Jones Room account describes two plaques, with a readable modern panel below the older monument. A Trinity College Library history independently records the brass memorial above the original-building door. The live room now includes a paired brass-and-timber display above the adapted west doorway: the upper plaque keeps the older monument's identification without invented Latin, while the lower plaque uses a short public transcription excerpt. A dedicated `henry-memorial-room` review route and close browser check confirm the lettering, layered frames and corner fasteners; the detail has no navigation collider and the Henry route remains clear.

Two Henry/connection tests passed. Exact plaque dimensions, full older inscription, heraldry and surveyed wall coordinates remain unresolved, so this addition improves source fidelity without changing the completion status of the whole reconstruction.

The dedicated plaque review now includes the shared north wall, doorway head and timber jambs used by the live west connection. The standing-height opening remains clear while the wall closes the space above it, removing the floating review background without duplicating the live connection's wall/collider.


### Full frontend validation after Henry plaque — 2026-09-10

The final frontend regression run completed with `pnpm --filter @bookkin/web test`: 91 test files passed and 275 tests passed. The run includes the Henry plaque/connection suite and the west-stair and password-policy assertions that were corrected to match the current shifted doorway and normal-password form state. `pnpm --filter @bookkin/web lint`, `pnpm --filter @bookkin/web typecheck` and `pnpm --filter @bookkin/web build` also exited successfully.

Vitest still prints the repository's jsdom CSS, pseudo-element and Canvas 2D capability warnings; they did not produce failing tests or browser runtime errors. The existing Ant Design Drawer `width` deprecation remains in the live browser log. This validates the current frontend snapshot, not measured 1:1 architecture, mobile behavior or a controlled GPU/FPS benchmark.


### Current runtime performance and real-category recheck

A fresh authenticated desktop page with four real catalog books measured worldBuildMs 501.2, worldFinalizeMs 16.8, shaderCompileMs 73.3 and longestBuildSliceMs 25.5 (construction-0). At the settled entrance it reported 188 draw calls, 6,547,238 triangles and idle rendering. These are current local snapshots with uncontrolled cache/host load, not a controlled improvement relative to older multi-second runs. Last render CPU submission time (4.5 ms) is not GPU frame time or FPS.

The component profiler had an obsolete static-batching prefix, falsely omitting the new static-* phase timings. It now includes all static-* callbacks and labels the measured scope explicitly. A fresh corrected run measured 481.1 ms construction/batching, 469 static steps totaling 31.5 ms, maximum static step 2.8 ms and no individual recorded step above 50 ms. Per-step timings do not replace a browser long-task trace. No model geometry or renderer was changed based on these healthy desktop timings.

Clicked the real Literature category in the authenticated page: four books focused, camera collision clear, complete shelf-frame NDC corners within the viewport, then rendering settled to idle. No full reading flow, cold start, mobile, large catalog or sustained GPU/FPS benchmark is claimed. Exact values/limits are in current-performance.json. Browser directly verified the small review-only reporting fix; no mirrored unit test was added.


### West upper storage rooms and route — 2026-09-10

The Y1.003 second-floor plan was rendered and inspected at high resolution. Its west-end labels are STORAGE 21 m², STORAGE 78 m² and CIRC. 4 m² beside the northern stair core. The modeled shell follows those partitions and window positions at source-relative floor +5.49 m, while retaining the enlarged-room caveat: 18.66 × 8 m is an adapted envelope and is not asserted to reproduce either net area.

The live west connection now adds the storage shell, door heads/linings, real window boundaries, two low plan-indicated storage benches and a supported three-tread transition from gallery +5.95 m to room +5.49 m. The front end-crosswalk guard has a centered 1.8 m opening aligned to a new upper portal; its rear guard remains continuous. The portal and route use adapted dimensions and are explicitly not surveyed original stairwork.

`WEST_UPPER_WALK` is exposed through the `西端储藏室` control. The browser route reached the room at distance 129.98 of 132.30 m, eye (−6.814, 7.140, −48.000), floor 2 and collision clear; the route test covers the complete forward/reverse path and physical support. The browser screenshot shows the open doorway, window joinery and continuous floor; console output retained only the pre-existing Ant Design Drawer width deprecation warning.

Focused verification after the final geometry: 3 files / 7 tests passed (`longRoom.test.ts`, `longRoomWestUpperRooms.test.ts`, `longRoomWestUpperWalk.test.ts`); lint, typecheck and build passed. Remaining gaps are the northern stair/core, measured room fit-out/inventory, and broader exact 1:1 architectural calibration. This entry does not claim the overall reconstruction complete.


### Historical benefactor frieze lettering — 2026-09-10

The official Trinity Long Room register page identifies the five names on the gold band below the gallery: James Ussher, King Charles II, William Palliser, Claudius Gilbert and Theophilius Butler. `longRoomDonorPanels.ts` now renders those names on both sides of the hall as a continuous visual frieze, replacing the earlier two modern donor panels. Typography, backing dimensions and absolute bay placements are explicit enlarged-hall adaptations.

The refreshed `/virtual-library` screenshot shows the gold lettering at gallery level. The change passed the Long Room suite (4 tests), lint, typecheck and build; the browser retained only the existing Ant Design Drawer width deprecation warning. The text is source-backed, but exact historical letterforms and spacing remain unmeasured, so this is a fidelity improvement rather than proof of full 1:1 completion.

### Benefactor plaques removed from the live hall — 2026-09-15

At the user's explicit request, all five repeated historical benefactor-name plaques were removed from both sides of the live Long Room. The source names remain recorded as architectural evidence, but the adapted green panels, lettering atlas and runtime construction call were deleted and must not be presented as current implementation.
