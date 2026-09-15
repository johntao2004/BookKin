# Trinity College Dublin Long Room reconstruction

Requested final state: replace the rotunda with a 1:1 reconstruction of the Old Library Long Room. One scene unit equals one metre. This is an active reconstruction, not yet an as-built certified model.

## Authoritative dimensions

Trinity College Library, A Great Many Choice Books, The New Library:
https://www.tcd.ie/library/exhibitions/choicebooks/newlibrary.php

- Internal length: 63.7 m; width: 12.2 m; apex: 14.2 m.
- 40 window-lit alcoves with bookcases perpendicular to exterior walls.
- Oak barrel vault and upper transverse bookcases completed in 1861.
- Carved perimeter timber gallery, Corinthian pilasters, busts on timber plinths beside projecting cases.

## Visual comparison

David Iliff, 21 July 2015, Long Room Interior:
https://commons.wikimedia.org/wiki/File:Long_Room_Interior,_Trinity_College_Dublin,_Ireland_-_Diliff.jpg
Reference only; do not use the photograph as a runtime texture. This defines the pre-conservation furnished architectural presentation, not the temporary Gaia installation or empty 2026 conservation shelves.

## Unverified detail dimensions

Gallery height, aisle width, bay spacing, joinery moulding profiles, window subdivisions, display case dimensions and individual sculpture shapes must be compared with further photos/plans. Initial values are derived proportions, not measured evidence. Exact 1:1 completion requires resolving these, matching both end walls and stairs, and browser comparisons from entrance, mid-hall, gallery and side alcoves.

## Product integration

Preserve authentication, private catalog and reader interactions. Architectural background volumes are explicitly scenery, never duplicate real catalog books. Catalog shelves and book inspection must use rectangular world transforms rather than polar coordinates. Existing fictional side rooms are not part of the historical reconstruction.

## User steering after first browser review

The user found the hall too small and requested a larger space. Active experience dimensions are now 90 × 18.3 × 20.4 m, with human-scale furnishings retained. Historical dimensions remain separately recorded in TRINITY_MEASURED_DIMENSIONS. This enlargement deliberately departs from strict 1:1 scale and must be described accurately.

### Enlarged hall daylight refinement

Adjusted lower sash window heights to the enlarged gallery datum and added an explicit upward daylight-bounce approximation so the downward-facing oak vault remains legible. This is a real-time lighting approximation, not a measured illuminance reconstruction. The authenticated local `/virtual-library` view was inspected after reload: the barrel lining and transverse ribs are visible. Portrait bust fidelity, joinery and end-wall furnishings remain incomplete; these changes do not establish 1:1 completion.

### Portrait and furnishing verification source

The official sculpture location register at https://onprem.tcd.ie/library/old-library/long-room/ (page updated January 2023, inspected during this revision) identifies individual busts by north-side single-letter and south-side double-letter stalls. It also lists the four occupants replaced in January 2023. The selected furnished historical presentation needs an explicit date-consistent register before attributing procedural busts to named sitters. Current repeated proportional studies do not satisfy that requirement. The same source documents the gallery benefactor lettering and the 29-string medieval harp. The lettering remains absent; the harp is now present as the intermediate study described below. These are outstanding fidelity requirements, not optional decorative additions.

Removed the product category plaques from the straight Long Room cases; their former rotunda placement created floating modern taxonomy signs absent from the reference. Classification remains available through product controls. Browser reload confirmed the unobstructed casework.

### Medieval harp study

- Official photographed reference inspected: https://www.tcd.ie/library/exhibitions/boru/images/Boru/500px/BoruHarp.jpg (viewing reference only; not packaged as a texture).
- Dimensional reference: Paul Dooley, *Report on the measurements of the Trinity College harp, 2012*, updated March 2014: https://www.galpinsociety.org/index_htm_files/GS_Dooley_Report2012.pdf . The model uses the published 32 cm to 12 cm soundboard width taper. Curved members are independently modeled from the photograph; no accompanying research-only mesh was downloaded or copied.
- Added a 29-string harp study with curved forepillar, dipping harmonic neck, tapered soundbox and tuning pins. Ornament, exact profile, internal hollowing, cabinet dimensions and display position remain approximate. This is an intermediate reconstruction, not a certified facsimile.
- Full frontend tests after daylight changes: 229 passed; BooklistDetailPage timed out at 15 seconds. Lint and typecheck passed before that test run. A focused rerun was started after the complete suite terminated to distinguish the timeout from a repeatable failure.

### Bust silhouette refinement

Viewed the official Roubiliac Swift photograph at https://www.tcd.ie/swift350/assets/img/slider/swift-by-roubiliac.jpg . It demonstrates the anatomical neck/shoulder transition and continuous carved surfaces absent from the earlier bead-like studies. Replaced detached repeated hair spheres with a skull-following carved surface and replaced the spherical torso with a tapered shoulder/chest mesh. The result is still a generic study: Swift's cap, bands, likeness and the other individual portraits remain unmodeled. No specific sitter attribution has been added. The updated silhouettes were inspected in the live long-hall view.

### Public-source reconstruction dataset (2026-09-09)

The user authorized assembling missing data from public material. See [public-data-notes.md](public-data-notes.md) and [public-reference-data.json](public-reference-data.json). This adds an explicit source/estimate distinction, pre-2023 side-stall register, distinct east/central/west circulation evidence, and working dimension ranges. Iliff's 960px full view, the official gallery detail, Skyden67's stair photograph and Casey's illustrated stairhall page have now been visually inspected. These research files do not claim that their geometry changes have already been implemented.

### Public-photo spiral stair component

Implemented `scene/longRoomStair.ts` as an independent alcove-stair study from the inspected Skyden67 reference. It models a continuous central post, fan treads, circular pierced risers, paired scrollwork and a helical handrail. Height, diameter and entry direction are parameters. It is available at `/model-review.html?component=stair`; the hall does not yet instantiate it because the exact alcove and gallery opening remain unresolved. This is separate from the west pavilion oak stair.

The browser preview was inspected on a light neutral background: 2 draw calls and approximately 35,648 triangles at the initial rail tessellation. Human rise and headroom checks pass at 5.8 m and 8.3 m connection heights. Lint/typecheck, the new component test and the production build passed. The stair remains a photo-derived study, not an exact cast-iron ornament facsimile.

### Central visitor stair integration

The official [Social Story](https://www.visittrinity.ie/wp-content/uploads/2025/09/Social-Story-Bokex.pdf), PDF pp.13 and 15, supplies distinct entrance and central-exit photographs. Both pages were rendered and inspected. Added the central rectangular floor opening, timber balustrades, descending treads, handrails and a lower landing to the active hall builder. The 2.5 × 5 m opening, z=0 location and 3.6 m descent are working estimates, not published dimensions. The lower exhibition rooms and exact stair location remain unresolved. One display case was shifted to leave the opening clear.

A raycast test verifies that the central floor actually has a hole while adjacent floor remains present; a camera collision test prevents flat-level navigation entering the void. Browser component=exit review confirms the opening, surrounding floor, balustrades and descending treads. Lower-level illumination is a real-time approximation. This is partial circulation reconstruction, not a completed accessible route to a modeled ground floor.

### Size-based shelving and inscription audit

The official [Collections: Old and New](https://www.tcd.ie/library/exhibitions/choicebooks/collections.php) states that books on both levels are shelved by size and gives stack-label endpoints A–W / AA–WW. Updated decorative book generation to use coherent row formats with small binding-height variation, replacing independent large random height changes. Browser full-hall review confirms the regular rows. This does not identify individual historic titles.

The label endpoints also demonstrate why the 38-bust register cannot directly supply the complete bookcase numbering sequence. The precise sequence, end cases and coordinate orientation still need evidence. Searches of official history, the 1891 college history and public photographs did not establish the complete gallery inscription transcription. No invented Latin or modern donor plaques were added.

### Long Room floor material and continuous mapping

Replaced the legacy near-black floor finish on the Long Room path with a dedicated warm-oak procedural texture, visually guided by the already-inspected Iliff full-room photograph. The wood tile uses a working plank width of 0.24 m, not a measured historical board width. Top-face UVs now derive from world X/Z coordinates, so splitting the floor around the central exit does not stretch or restart the wood pattern. The 512px floor texture replaces, rather than supplements, the old 1024px map. Other scene callers retain their previous material default.

Reduced marble diffuse reflectance under the existing lighting to retain more surface shading. This is an appearance approximation, not calibrated material measurement. The full-hall browser view was checked after the change. Generic sitter geometry and exact lighting remain incomplete.

### East-end screened collection study

Split the east end from the west doorway treatment. The east wall now has an actual opening, a recessed bookcase and a metal screen, reflecting the official architectural history's account of the retained Fagel enclosure. Positive Z is the model's provisional east orientation. The 2.1 × 3.25 m opening and 1.2 m recess are a working study, NOT a recovered plan of the Fagel room or proof of its exact relationship to the entrance. The complete east pavilion and concrete entrance stair remain unmodeled. Browser review confirms a visible screen and recess, and the existing room boundary remains closed to navigation.

The 1891 college history adds historical drawings of two different timber stair arrangements and records an 1848 east-wing reading-room spiral. These do not establish the location of the surviving photographed iron alcove stair. The 2023 Fagel report pp.2 and 8 were inspected for casework context but do not resolve the grille's current shape. Keep these historical and contemporary evidence scopes separate.


## 2026-09-09 — Walkable second level and material/shadow refinement

User review identified an inaccessible upper floor and crude floor/ceiling/lighting. Added a circulation adaptation for the enlarged experience: a 1.4 m oak stair (46 risers over 8.3 m, 16.6 m horizontal run), top landing, widened galleries (inner railing x=±3.8; case fronts start at |x|=5.25), and a 2.4 m deep far-end crosswalk. This stair and crosswalk are original virtual circulation additions, NOT surveyed Trinity geometry. The original dimensions and public-source records remain separate.

The `前往二楼楼梯` control starts a constrained walking route. `前行`/`后退` traverse the physical stair, both galleries and connecting platform, with interpolated eye height 1.65 m above the route. Dragging looks around. `返回自由视角` restores orbit mode; catalog shelf focus exits walking mode. This is a guided circulation route, not unrestricted first-person WASD navigation.

Floor and vault now use coordinated plank grain/board joints with bump mapping; the upper-floor surfaces keep world-scaled grain. The barrel lining has its own board UV mapping and shadow-casting ribs. One static 4096² directional shadow map adds architectural, statue, railing and stair shadows; ambient/floor bounce keeps the interior legible. Anonymous instanced volumes do not cast individual shadows. Mesh merging now respects cast/receive-shadow flags. Exterior solid backing is excluded from shadows as an approximation until true wall apertures are modeled; this is not a physically complete daylight simulation.

Validation: lint and typecheck passed. The Long Room and spiral-stair suites passed (4 tests), including ray checks for physical support every 0.2 m over the complete gallery route. Browser checks at the actual authenticated localhost:4175/virtual-library route confirmed stair ascent to eye Y=9.95 m, right gallery and far-end crossing (x=2.061,y=9.95,z=-43). Complete return/left-side browser verification is tracked separately below. Observed 4 real catalog books remain in the scene. A gallery sample rendered 23 calls at idle; rendering stops when settled. These are local samples, not a general device performance guarantee.


Final browser circulation check after the build-triggered reload: followed the route to the opposite gallery endpoint (distance 183.61 m; camera x=-4.55, y=9.95, z=41.998), then returned along the same route to the stair foot (distance 0; x=3, y=1.65, z=42.998). Both settled to `renderState=idle`. `我的藏书` exited route mode and focused section 0 with all four real catalog models. Lint, typecheck, the 4 targeted tests and production build completed successfully. The accidentally unfiltered full frontend run encountered multiple unrelated-page failures/timeouts (MetadataDialog, ReaderPage, DisplayBooksSettingsPage, CategoriesPage, BatchRenameDialog); it was stopped after over nine minutes rather than treating it as a passing full-suite result. Full-suite validation remains incomplete.


## 2026-09-09 — Physical wall apertures

Replaced both continuous non-shadow-casting exterior backing boxes with solid piers, spandrels and heads surrounding 80 real window apertures. All solid wall parts cast shadows. Glazing is recessed behind oak reveals and a projecting sill. This supersedes the preceding note about excluding solid backing from shadows. Existing window dimensions remain estimates (1.5 m wide, lower sill 1.25 m / height 6.2 m, upper sill 9 m / height 1.95 m); they are not claimed to match a measured Trinity sash. Opaque luminous glazing remains an exterior approximation.

Daylight now crosses the actual openings; near-perpendicular side light produces window-grid pools on the floor while piers block light. The lighting direction is a working visual setting, not a documented solar orientation. The actual authenticated hall route was visually inspected, and model-review.html?component=window was inspected close up for reveal, sill and glazing depth. The 80-aperture ray test verifies both levels on both sides are open while adjacent piers remain solid and cast shadows. The complete guided gallery support test also remains passing.


## 2026-09-09 — First individual portrait study

The official [Long Room register](https://www.tcd.ie/library/old-library/long-room/) identifies Roubiliac's Jonathan Swift at north Stall I. Inspected the [official Swift350 side-view photograph](https://www.tcd.ie/swift350/assets/img/slider/swift-by-roubiliac.jpg) and [Illustratedjc's 10 May 2015 frontal photograph](https://commons.wikimedia.org/wiki/File:Louis_Francois_Roubiliac_-_Jonathan_Swift_bust.jpg) in the browser. The latter is CC BY-SA 4.0; no photographic pixels were bundled in the application.

Replaced one generic bust with a procedural study incorporating the folded cap, rolled edge, short hair, paired clerical bands, carved robe borders and flared rectangular socle. Corrected inward-facing cap/trim polygons and stretched the torso to better match the observed head-to-body proportion. Its documented stall is retained in metadata, while runtime north bay 8 (x=-4.74,z=8.67) is explicitly an estimated coordinate mapping. It is not a verified historic placement or portrait facsimile.

Viewed the isolated sculpture and its in-hall placement via model-review.html?component=swift and ?component=swift-in-hall. The rendered face is still overly smooth and simplified; likeness, fine cloth carving, exact scale, unseen surfaces and socle inscription remain incomplete. Other busts remain generic. Lint/typecheck, 3 Long Room tests (including one-study integration and outward-facing trim check), and build passed. Existing floor-support and window-aperture tests remain in the same passing suite. No claim of full-suite success or 1:1 completion is made.


## 2026-09-09 — Upper-shelf supports

The inspected [official Ste Murray upper-gallery detail](https://www.visittrinity.ie/wp-content/uploads/2023/01/SM_1561_0395_web_PhotoBySteMurray.jpg?w=720) shows supported timber shelving rather than unsupported thin planes. Added repeated triangular timber supports below upper-level shelves. Their 32 mm thickness, 212 mm projection, 140 mm drop and three positions per sufficiently wide shelf are working construction estimates, not measured original joinery.

All supports share one InstancedMesh. Decorative volumes immediately below a support leave binding clearance; the real-catalog lower shelves are unchanged. Support positions for each row are calculated once and reused. Historical spine bands now receive shadows consistently with their books. Inspected the geometry at model-review.html?component=shelf-support. Added geometric checks that all support instances remain above the gallery floor, inside the outer wall and outside the walking aisle. The existing circulation-support/window-opening/portrait integration tests continue to pass (3 tests total in the file); lint/typecheck/build passed. The actual page subsequently showed an unavailable API; the 8080 listener was confirmed absent, with no active startup process, so the prescribed pnpm start:local recovery was initiated separately from model verification.

Local service recovery completed: actuator status UP, immutable snapshot startup reported both API and Worker ready. The authenticated actual /virtual-library page loaded all 4 catalog models, reported 33 draw calls and 6,216,274 triangles in the sampled entry view, and settled to idle. These are local rendering observations, not a cross-device benchmark.


### 二楼入口与路线提示补充

- 二楼入口按钮独立占一行，避免与前行、后退、藏书按钮挤在同一行。进入步行后明确提示前行上楼、沿回廊绕行、后退下楼及拖动环顾。
- 现有路线连接 1.4 m 楼梯、两侧回廊及远端横向通道；属于放大体验的通行改编。每 0.2 m 采样检查实体踏步或地板支撑。
- 东端入口依据公开 Matterport 导览调整为双拱龛与开放门扇，前厅铁网书柜位于南侧，尺寸仍为估计。坐标约定 z 正向为东、x 正向为北，Swift 的北侧位置据此纠正。
- 本次浏览器工具未返回任何可连接浏览器，打开预览工具亦未返回结果；不将本次界面改动声称为浏览器复验通过。
- 本轮验证：lint、typecheck、Long Room 与螺旋梯专项测试（2 文件、4 项）及 build 均通过。全量前端测试此前出现页面测试失败和超时，未声称全量通过。


### South entry spiral integration

The existing photo-derived spiral now sits in the south entry alcove observed in the earlier public tour. The official tour entry was rechecked at https://www.visittrinity.ie/venue/the-long-room/ . Browser discovery returned no browsers this turn, so local and reference visual revalidation is pending.

The x=-7.25, z=41.1825 anchor, 1.8 m diameter and 8.3 m rise are enlarged-experience estimates. Four gallery slabs and corresponding colliders leave a real 2.2 m square aperture. A short upper landing and perimeter guards complete the connection. Iron geometry casts and receives static shadows. The separate adapted guided walking route remains available; the spiral itself is not yet a guided route.

Review paths: /model-review.html?component=stair-in-hall and /model-review.html?component=stair-opening. The review page now invalidates on texture completion and resize.

Validation: lint and typecheck passed; two targeted files / four tests passed. Build is still running in exec session 33075; log /tmp/bookkin-spiral-integrated-build.log. Do not restart solely because it is slow. Browser visual verification remains pending.


### Closed far-end composition study

Inspected the embedded photo extracted from the official Social Story PDF page 15 at .local/research/trinity-long-room/exit-photo-000.jpg. It clearly shows a closed central door, paired arched statue recesses, fluted pilasters and a layered cornice. West orientation remains an inference from comparison with the open east-entry tour.

Replaced the simplified west wall with the shared arched end module, rotated to face the hall. West leaves remain closed; the east-only vestibule and Fagel screen are not duplicated. Niche portraits, detailed capitals, upper termination and pavilion spaces remain unfinished. All dimensional anchors are estimates. Review path: /model-review.html?component=west.

Previous spiral integration build completed successfully (session 33075 exit 0).

West-end validation: added a closed-door meeting stile after the exact central seam ray missed the two adjoining leaf boundaries. Left panel, right panel and center stile now pass ray checks; closed west boundary and open east axial view are both retained. Long Room tests (3), lint, typecheck and build passed. Browser connection remained unavailable, so this is geometry/build evidence only.


### Restored browser verification and end-wall light correction

Browser connection recovered. Port 4175 had no listener, so Vite was restarted in exec session 24309; existing API health was UP and was reused. Stale error tabs could not be inspected because their generated data URL was rejected; fresh normal HTTP tabs worked.

The west-end screenshot showed nearly black joinery. End wall now uses the warm wood material, darker niche backing and one shadowless reflected-light approximation per end (intensity 180, distance 18, decay 2). The single cached sun-shadow arrangement remains. Before/after screenshots show readable panels and recessed niche contrast; this is an artistic fill, not measured illumination.

Visually checked spiral-in-hall and stair-opening views: the spiral passes through the floor aperture, upper landing touches the gallery and guards surround the opening. Component view console had no warnings/errors. After build token regeneration, the main route was reloaded and the stair shortcut plus 12 forward clicks reached walkDistance 24.00, floor 2, camera (4.550,9.950,22.510). Screenshot shows continuous walkable gallery. Four real catalog books remain. Main view reported 24 draw calls, 6253781 triangles, idle after settling, build 1919.8 ms and longest construction slice 148.9 ms; these are this local view only. Existing Ant Design Drawer width deprecation messages remain.

This verifies visible integration, not historical likeness. Niche portraits, capitals, finer timber materials and overall photo matching remain incomplete. Main preview tab retained as deliverable; component review tab retained for the next continuation.


### Pilaster capital silhouette refinement

Viewed Arran Q Henderson's original 2013 photograph via the linked image on https://arranqhenderson.com/2013/09/19/the-pantheon-in-the-library-the-sculpture-busts-of-long-room-trinity-college-dublin/ . It shows carved leaf ornament and layered capital projections, whereas the runtime previously used isolated torus rings. PublicDomainPictures was not used as visual evidence because its page displayed an automated security check. No challenge was bypassed.

New longRoomCapital.ts constructs two rows of closed scalloped relief leaves, tapering volutes, neck mouldings and abacus layers, with shallow veins and UVs for the existing wood material. This is original estimated geometry, not a measured capital facsimile. It replaces the side-aisle pilaster capitals at both levels; end-wall capitals remain simple.

Browser close-up at /model-review.html?component=capital verified visible leaf relief, wood texture and curled edges; the first version lacked leaf UVs and was corrected. Console returned no errors/warnings. This camera reported 20 calls / 6805623 triangles (view-dependent, not comparable directly with the stair-opening camera). Exact carving and portrait fidelity remain unfinished.

Final capital validation: lint, typecheck, 3 Long Room tests and build passed after the leaf UV/vein correction.


### Historical shelf-lettering study

The official 2012 exhibition https://onprem.tcd.ie/library/exhibitions/choicebooks/collections.php identifies north stacks A-W and south AA-WW, with size-based shelving. These large stack identifiers are distinct from the lower-case sequences visible on the case stiles in the inspected Henderson photograph and official Social Story photo.

Added lower-level a-i / aa-ii only. Higher sequences and large stall identifiers remain absent rather than guessing their ordering. Placement repeats across estimated bays; typography uses Georgia as an approximation. The letters are scenery and do not define addresses for private catalog books. A single 1024x384 canvas atlas and indexed mesh cover all labels.

Browser /model-review.html?component=shelf-marks confirmed upright letterforms aligned to timber stiles without covering bindings. Console returned no errors/warnings. The view reported 37 calls / 6809480 triangles; this differs from the capital camera and is not a like-for-like performance comparison. JSDOM lacks canvas getContext, so unit tests skip the texture path; live browser inspection is the evidence for lettering.

Lettering validation: lint, typecheck, three Long Room tests and build passed; canvas lettering specifically verified in the browser as noted above.


### Shakespeare portrait differentiation

Viewed the original photograph linked from Henderson's article: https://arranqhenderson.com/wp-content/uploads/2013/09/shakespeare.jpg . Visible features include pointed falling collar, doublet buttons, sweeping cloak, moustache and short beard, receding forehead and side hair, and a flared inscribed socle. The official register assigns Shakespeare to south Stall BB; the runtime entry-adjacent coordinate remains an estimate.

The south entry bust now uses a dedicated Shakespeare configuration rather than the generic body/hair variation. Initial browser inspection exposed disconnected tube-like cloak folds and a neck gap; these were replaced by a continuous relief surface and adjusted head offset. A second screenshot confirmed the changed silhouette and connected neckline. Facial likeness, hair curl treatment, cloth tips and socle inscription are still inadequate: this is a proportional costume study, not portrait-fidelity completion. Runtime now has two named portrait studies and 38 generic busts. Review path: /model-review.html?component=shakespeare.

Shakespeare validation: lint, typecheck, three Long Room tests and build passed after the continuous mantle and neck correction.

### 2026-09-09 — Exploration, collision retention and gallery stair repair

User feedback: wheel zoom stopped too early, shelf views clipped through geometry, and the access stair needed correction.

- Hall wheel travel and forward/back controls now translate along the current viewing direction. Book inspection retains its independent zoom. Shelf focus lands directly at a stand point instead of sweeping through intervening stacks; the entry alcove uses an oblique stand point to clear the historic spiral, and focused orbit is restricted to the visible face.
- Static batching previously discarded collision descriptors attached to meshes. It now retains transform-only collision anchors, preserving floor/tread obstacles without restoring their individual render draw calls. Upper cases, gallery body guards, access stair guards and the historic spiral envelope are included. Guided travel now sweeps its eye against the same collision set.
- The enlarged-hall access adaptation has two 23-riser flights with a 1.6 m supported intermediate rest landing. The upper landing is deeper; its guard terminates at the gallery edge, and the path continues past the final stair post before turning. This remains an estimated circulation adaptation, not the original surveyed historic stair.
- New regression checks compare the complete collider set before/after static batching and sweep the entire route in both directions at 0.2 m intervals. They also sweep through both lower and upper bookcases. Targeted Long Room and collision tests: 13 passed. The JSDOM canvas warning still applies to decorative lettering, not collision coverage.

Live verification on localhost:4175/virtual-library after the final guard adjustment: forward controls moved from z=41.599 to z=10.099 without the former zoom cap; catalog focus kept all four real books visible outside the historic spiral. The complete gallery route reached distance=184.11 at (-4.55, 9.95, 42), then returned to distance=0 at (3, 1.65, 43.5), floor=1, collision=clear. Browser console contained the existing Ant Design Drawer.width deprecation only. Lint, TypeScript and build passed. The full frontend suite was also launched separately; its password-policy form test failed, so this is not a claim of a clean full-suite run.
Full frontend suite final result: 64 files passed, 1 file failed; 234 tests passed, 1 failed (`src/auth/password-policy.test.tsx`, rules-before-submission form assertion). No changes were made to that unrelated test or password-policy implementation in this navigation repair.

### 2026-09-09 — User-directed proportions, category zones and finish revision

The user rejected the tall cabinets, narrow room, missing category integration and lamps, crude windows, inconsistent vaults, repeated sculptures and central tables. This supersedes the earlier enlarged proportions: width 22.3 m, total height 18.45 m, central aisle 14.2 m, lower case 5.4 m, gallery 5.95 m. Source measurements remain unchanged separately.

Dominik Gehl's primary photograph at https://dominikgehl.com/ireland/dublin/library-trinity-college (image 01, visually inspected in browser) shows the central longitudinal barrel separately from the side alcove ceilings. The builder now uses a 7.25 m central radius at 11.2 m spring and 40 independent shallow side vaults, with sealed spandrels/end closures. These dimensions are working adaptation estimates. The same photograph is reference only; no photographic asset is packaged into the app.

Removed central display tables and harp cabinet and withdrew all rough busts from the live hall; component sculpture work remains recoverable. Added eight brass/glass wall lamps with curved arms, lathed cups/shades and four local point lights. These fixtures are an adaptation requested for visible lighting, not claimed to be historic originals. Windows gain rounded beads, layered framing and curved sash catches; circular tube cross sections now use 16 sides instead of 8.

Catalog category counts now reserve separate cases in the same sorted order as book placement. UI category buttons navigate to the first occupied case. Reservations begin beyond the entry spiral, avoiding its obstruction. Shelf focus derives FOV from both cabinet dimensions and viewport aspect. Live four-corner normalized projection bounds: x ±0.330, y -0.923 to 0.846, proving the whole active cabinet frame was within the desktop viewport. All four real books remained visible. New gallery landing reached (6.55, 7.6, 18.084), floor 2, collision clear. The complete route is swept in both directions by regression tests.

Validation: lint, typecheck and build passed. Targeted scene/layout/collision tests: 52 passed. Full suite initially reported an incorrect new category-test fixture expectation (the pre-existing classifier resolves its essay/history keyword tie to literature); the fixture was corrected with explicit separate humanities tags, and targeted tests rerun successfully. The full suite also retains the unrelated password-policy form failure. Browser logs showed existing Drawer.width deprecation only. Sculpture likeness and finer material/window work remain incomplete; this revision is not a claim of a finished 1:1 replica.

### 2026-09-09 — Lower-window fabric and sash layers

Primary reference: Dominik Gehl's bay photograph, https://images.dominikgehl.com/images/ireland/dublin/library-trinity-college/library-trinity-college-02.webp , visually inspected from the photographer's public page. The lower window is covered by a soft translucent blind, with a blurred multi-pane sash grid and stronger middle meeting rail visible through it. The photo also shows a top roller and loose lower folds. No source image is bundled as an app asset.

Added 40 lower-window blinds with a shared 96×256 procedural weave/transmitted-shadow texture and a 24×40 draped surface, plus separate rollers. Sash grids now have six rows and a thicker overlapping meeting rail. These remain estimated joinery/fabric forms under the user-requested room adaptation. The cloth uses an opaque lit approximation of diffuse transmission, not physical fabric simulation. Close inspection caught hardware protruding through the cloth; the blind/roller assembly was moved inward to clear the meeting rail and catch. The final full-window view shows continuous fabric without those penetrations.

Lint and typecheck passed; four Long Room structural tests passed. Main browser/render and final build checks are recorded below once finished. The sculpture and full-room fidelity gaps remain open.
Final build passed. Main /virtual-library finished loading and returned to idle rendering: 34 draw calls, 7 textures, 4,718,614 rendered triangles in the default view. Console retained the existing Ant Design Drawer.width deprecation; no new rendering error was observed. This is local scene evidence only, not a completion claim for 1:1 reconstruction.

### 2026-09-09 — Window-end bookcase ladders

Continued from the photographer's bay reference: https://dominikgehl.com/ireland/dublin/library-trinity-college, image 02. Added paired narrow leaning ladders at lower bookcase window ends, with round timber rungs, rounded feet, curved metal hooks and bracketed hanging rails. Dimensions (0.42 m wide, lower-case height minus 0.15 m, 0.48 m foot spread) and repetition across bays are estimates; the photograph does not independently prove every repeated placement. The south entry alcove is excluded to preserve the historic spiral. No source photograph is used as a runtime texture.

Ladder colliders remain on their groups through mesh batching. Existing before/after collider equivalence and complete forward/reverse gallery-route sweeps passed (four Long Room tests). Ladders are static bookcase scenery, not the walkable stair to the upper gallery. Near-window and angled close views were inspected; stepped rungs sit between the stiles and the hanging rail is bracketed to the case face.
Final ladder revision lint, typecheck and build passed. No claim is made that the replicated ladder placements are measured or that the full Long Room reconstruction is complete.

### 2026-09-09 — Gallery cornice relief study

Visually compared Ste Murray's official gallery photograph (https://www.visittrinity.ie/wp-content/uploads/2023/01/SM_1561_0395_web_PhotoBySteMurray.jpg?w=720) and Dominik Gehl's axial image (https://images.dominikgehl.com/images/ireland/dublin/library-trinity-college/library-trinity-college-01.webp). The photographs support repeating curved corbels beneath the balustrade, layered cornice members and a fine lower ornamental band. Added an estimated beveled modillion profile, dentil band, rounded continuous mouldings and recessed backing. Fine foliage and inscriptions remain unresolved and are not invented here.

Corbels and dentils use two instanced meshes rather than one draw call per ornament. The near-cornice review view confirmed attachment to the backing and readable cast shadows. The review also exposed faceted turned balusters; their radial segmentation was increased from 10 to 20. Dimensions and repeat spacing remain estimates under the user-requested larger, lower-case adaptation.
Final lint, typecheck, four Long Room structural/collision-route tests and build passed. Final cornice screenshot verified the relief and smoother baluster silhouette. These checks do not establish historical accuracy of every carved motif or completion of the full reconstruction.

### 2026-09-09 — Lower end-wall joinery and far-end pediment

The reduced gallery height had left earlier end-wall panels and niche crowns too high. Lower end-wall joinery now shares one vertical transform tied to the gallery height, with matching wall-aperture paths. Niche arc radii compensate for that transform so their crowns remain circular instead of being squashed into ellipses. Door and vestibule proportions follow the same lower-level transform.

The far-end central doorway in Dominik Gehl's axial photograph (https://images.dominikgehl.com/images/ireland/dublin/library-trinity-college/library-trinity-college-01.webp) has a triangular pediment. Added its estimated tympanum, horizontal cornice and two raking mouldings to the west-assigned end. The orientation assignment is still inferred, not newly proven. East retains the rectangular overpanel previously observed in the entry tour. Raised-panel borders and curved pulls make both pairs of door leaves readable; their small profiles are estimates rather than scanned hardware.

Both end-wall close views were checked. Structural regression now verifies that niche rise equals half its width after transformation, upper niche/panel/pediment extents stay below gallery height, and the wall strips between openings contain no accidental geometry holes. Existing collision preservation and gallery-route sweeps still pass. Final lint, typecheck, four Long Room tests and build passed; a subsequent wall-strip test addition also passed. Sculpture likeness, niche occupants and remaining survey/fidelity gaps remain open.

### 2026-09-09 — Independent ceiling boards and metric timber grain

The barrel lining previously reused the floor texture, including floor joints. It now uses independent shared 256×256 procedural albedo and bump maps with continuous boards. Central and side vault UVs follow their respective longitudinal/transverse surfaces. Mapped box boards use metric grain along the longest dimension; each face uses two independent coordinates to avoid collapsed side/end UVs. Board widths and grain scale remain visual estimates, not measured joinery. No reference photograph was copied into a runtime asset.

Final lint, typecheck, four Long Room structural/collision tests and build passed. The full hall screenshot was inspected after rebuild. Actual category-button interaction showed all four real books and the whole cabinet frame (NDC x ±0.330, y −0.923..0.846); camera collision was clear. Console retained only the existing Ant Design Drawer.width warning. This bounded run did not rerun the full suite; its previously recorded unrelated password-policy failure remains unresolved. Sculpture likeness and overall historical fidelity are still incomplete.

The final browser walk reached the second-floor gallery at (6.55, 7.60, 12.084), reported floor 2 and collision clear; the gallery screenshot confirmed a continuous visible walking surface.

### 2026-09-09 — Curved historical bindings

Viewed Dominik Gehl's public bay image directly in the browser: https://images.dominikgehl.com/images/ireland/dublin/library-trinity-college/library-trinity-college-02.webp (page: https://dominikgehl.com/ireland/dublin/library-trinity-college). Its aged tan collection and repeated horizontal binding divisions informed a representative anonymous binding study. Individual titles, exact tooling and per-volume dimensions are not established by this reference.

Replaced scenery boxes plus detached box bands with one shared extruded curved cross-section. Smooth normals remove segmented reflections on the spine while retaining distinct end faces. Shared 128×256 procedural maps add leather grain, raised-band bump, tooling, blank label panels and wear. Instance colors now emphasize tan leather over the previous green/red mixture. No source image is packaged into the application. These remain decorative volumes, separate from real catalog books.

Near-case screenshots were used to correct initially pale tones and faceted normals; the final full hall was also inspected. Structural/collision regression: four Long Room tests passed. Final lint/typecheck/build completed successfully. Full suite was not rerun for this bounded appearance change; its earlier password-policy failure remains unresolved. Main scene loaded successfully (35 draw calls in the observed initial frame); this is not a controlled performance comparison. Fine lettering, broader binding variation, sculpture likeness and full historical fidelity remain unfinished.

### 2026-09-09 — Modeled pilaster flutes

Directly inspected the photographer's pier detail: https://images.dominikgehl.com/images/ireland/dublin/library-trinity-college/library-trinity-college-03.webp . The photo establishes curved recessed grooves; it does not show the capital clearly enough to verify its carving. This iteration therefore addressed the shaft rather than inventing additional capital ornament.

Replaced the five dark rectangular strips on each shaft with a continuous concave front surface and rounded stops. The old box front plane is removed so it cannot cover the recesses. Shaft external bounds are preserved; grooves are estimated at 18 mm half-width, 14 mm depth, 57 mm spacing and 120 mm end transitions. Near-shaft and upper-junction screenshots show curved shading and attached mouldings. Capital leaves and volutes remain estimated studies.

Lint, typecheck, four Long Room structural/collision regression tests and build passed. This run did not repeat the full frontend suite and does not resolve its previously recorded unrelated password-policy failure. Overall reconstruction remains incomplete.

### 2026-09-09 — Capital relief and volute geometry

Inspected the axial reference directly in the browser: https://images.dominikgehl.com/images/ireland/dublin/library-trinity-college/library-trinity-college-01.webp . It supports the spreading leaf-and-scroll silhouette; individual carved profiles and dimensions remain estimates.

The existing leaf shells had nearly flat tips and the scrolls were uniform six-sided tubes. Leaf tips now curl down and narrow, deeper scalloping separates lobes, and side-return leaves continue the relief around the core. Scrolls use twelve-sided cross-sections tapered to 27 percent toward their inner ends, with rounded closures. Frontal and oblique close views were inspected for attachment and silhouette. This improves the procedural study, but is not evidence of a scan-matched or completed historic capital.

Lint, typecheck, four Long Room structural/collision tests and build passed. Full-suite password-policy failure remains outside this bounded model change. Remaining fidelity gaps include the exact capital carving, portraits and inscriptions; overall completion is not established.

### 2026-09-09 — Swift multi-angle source and head-section study

Found and inspected David Bridgwater's first-person photographic record, dated 4 October 2016: https://bathartandarchitecture.blogspot.com/2016/11/jonathan-swift-by-roubiliac-trinity.html . The post contains ten linked sculpture photographs before its separate engraved-source discussion. Directly viewed DSC_6289-lo-res.jpg (near profile) and DSC_6294-lo-res.jpg (opposite three-quarter view). These establish the projecting nasal profile, fuller lower face, irregular soft cap and draped collar arrangement. No photographs were downloaded or bundled into app assets. The search also found a downloadable generic Shakespeare scan, but its description did not identify Trinity's Scheemakers bust, so it was not substituted. The V-SENSE project remains evidence of an existing reconstruction, not an obtained reusable scan.

Replaced Swift's sphere-based face study with explicit normalized cranial/facial sections and continuous Hermite interpolation; integrated brow/socket/nasal/lip/chin relief is retained on one surface. The first preview exposed transverse interpolation bands; those were corrected by carrying section slopes continuously. A temporary expression syntax error was fixed, and final lint/typecheck/build passed. The revised model-review view was compared with both source views.

The comparison still shows substantial likeness failures in expression, eyelids, cap proportions, ears and drapery. This is research and geometry progress, not an accepted portrait. Swift remains absent from the live hall; no generic replacements were reintroduced. Full-suite tests were not rerun for this isolated review model.

### 2026-09-09 — Swift cap envelope and collar attachment

Continued from the directly inspected Bridgwater profile and three-quarter photographs recorded above. Replaced the low cap envelope and tube rim with a taller asymmetric crown, a lower edge descending behind the ears, and a separately folded band. Rear hair extends farther down with a scalloped edge. These dimensions and folds remain estimates.

A new profile review exposed the clerical collar as a vertical plate standing away from the neck. Its upper vertices now curve back toward the neck while the lower end remains over the chest. Final profile and three-quarter screenshots were inspected. The cap, hair and expression remain too generalized for an accepted portrait; the model is still excluded from the live hall. Final lint/typecheck/build passed; no full-suite rerun for this review-only sculpture revision.

### 2026-09-09 — Swift eyelid surface study

Continued against the previously inspected Bridgwater photographs. Added upper/lower eyelid surfaces whose outer margins are sampled against the current head geometry, plus a recessed carved eye surface. Initial close inspection showed deep socket shadows and ring-like rim projection; brow/socket relief and rim height were reduced, and the eye opening widened. The final close view was inspected.

This is an estimated surface study, not evidence that the portrait likeness is complete. It remains excluded from the live hall. Lint/typecheck/build passed before the last numeric rim-height adjustment; a final build verifies that adjustment separately. No full-suite rerun for this review-only sculpture change.

Final build after the rim-height adjustment passed.

### 2026-09-09 — Independent floor surface maps and staggered joints

Located Marion QUESNE's photograph explicitly captioned as the Long Room wooden floor: https://www.flickr.com/photos/134152424@N02/19054337425/ , taken 28 May 2015. The directly viewed image area shows worn joints and irregular grain; it was monochrome and partially loaded, so it provides no defensible absolute color or board dimension measurement. Existing board-width and tile-size estimates are retained. The previously opened official Ste Murray image was an upper-gallery view, not floor evidence.

Replaced the continuous strip texture with board-local color/grain reset across staggered joints and independent albedo/relief/roughness maps. Removed the floor's albedo-as-bump override. A first near-floor view exposed a cross-hall line at the texture boundary; per-column phase offsets eliminated it. The corrected close view shows individual boards without that repeated straight seam. All surface maps are procedural; no source photograph is bundled.

Final lint/typecheck, four Long Room structural/collision tests and build passed. Full hall screenshot inspected after loading: idle render state, 35 draw calls, 13 textures, collision clear. Console retained the existing Drawer.width deprecation only. Full-suite password-policy failure was not revisited. Floor wear and dimensions remain estimates; this does not establish overall replica completion.

### 2026-09-09 — Window-end paired reading stands

Inspected Rosemary Sullivan's photographs at https://irishwishingwell.com/blog/library . The image captioned Gold Lettering actually shows lower-case cc/dd on a shelf upright, not the gallery frieze. Double R shows QQ/RR on the shaped end cartouches of a double sloping reading stand between ladders at the window. The official Long Room page confirms single-letter north stalls and double-letter south stalls, and identifies the frieze benefactors, but does not give a complete inscription transcription. No invented Latin frieze was added.

Added paired sloping reading surfaces, retaining edges, curved supports, circular lower scroll relief, shaped lettering cartouches and a floor base at window ends. Repetition at 39 windows and dimensions remain estimates; the south entry spiral bay is excluded. Only the photographed QQ/RR pair is transcribed, at an estimated south bay 15 assignment. Other cartouches remain unlettered. These stands occupy the window ends; central display tables remain absent. Each stand carries a camera collider.

Close review revealed incorrect shading on a negatively scaled support after static batching. Replaced negative scale with a half-turn plus depth compensation, and rechecked the resulting surface orientation. Final component screenshot shows attached supports and legible QQ/RR. Lint/typecheck, four structural/collision tests and build passed before the final orientation correction; structural tests and build were rerun after it. Further inscription and survey work remains open.

Post-orientation structural/collision tests and build passed. Main scene reports 383 colliders. Actual category-button interaction returned all 4 real books with the full cabinet frame inside the viewport and collision clear. Console retained only the existing Drawer.width deprecation. Complete two-way gallery circulation is covered by the structural route sweep; it was not manually walked again in this iteration.

### 2026-09-09 — Shelf-front nosings and support edge profiles

Continued from the previously inspected official Ste Murray upper-shelf photograph and Gehl's pier/stack detail. Added a continuous rounded timber bead at each shelf front, using one instanced mesh. The 14 mm radius is an estimate, not a surveyed dimension. Upper support triangles now have 3 mm beveled edges; extrusion thickness was reduced so the final lateral extent remains the original 32 mm. Support-face wood UVs use metric coordinates.

A near-shelf view verified the continuous edge highlight, support-to-shelf attachment and retained book spaces. Final lint/typecheck, four structural/collision-route tests and build passed. These checks do not establish exact historical joinery or overall completion.

Post-build category focus still showed all four real books and the complete cabinet frame, with collision clear. Console showed the existing Drawer.width deprecation only. The full frontend suite was not rerun in this bounded appearance revision.

### 2026-09-09 — Lower blind direct-light occlusion

Corrected the lower fabric blinds to cast shadows: previously the direct sun passed through them unchanged and could project sharp sash grids despite the modeled cloth. Existing diffuse hall lighting and the emissive fabric texture remain the approximation for scattered transmission; this is not a physical fabric transmission simulation. Unblinded upper windows retain direct sunlight and sash shadows. No extra lights or shadow maps were added.

Live browser review confirmed readable floor, shelves and vault. Post-build category interaction showed all four catalog books and the complete cabinet frame, with collision clear (383 descriptors). Lint, typecheck, four structural/collision tests and build passed. Console retained the existing Drawer.width deprecation; full frontend suite was not rerun. Overall historical fidelity remains incomplete.

### 2026-09-09 — Binding variation and width-aware arrangement

Reopened [Dominik Gehl's pier and stacks photograph](https://dominikgehl.com/ireland/dublin/library-trinity-college) (image 03). It shows matching short runs alongside individually varied thicknesses, heights, dark labels and band patterns. Replaced the fixed-pitch, nearly equal-width scenery placement with width-aware sequential packing; estimated thickness is 24–72 mm, gaps 3 mm, height variation up to 35 mm around the row format, and recession 0–12 mm. Matching five-volume runs are a reconstruction convention, not a transcribed inventory. Updated bracket clearance to include each binding's actual half-width.

Four instanced binding styles now share one geometry, with different band positions, label layouts and color variation. The conspicuous sinusoidal wear was reduced after near-view review. Photographic book titles and source image textures were not copied. These anonymous scenery books remain separate from the four real catalog entries.

Lint/typecheck, four structural/collision tests and build passed (the final wear-amplitude numeric adjustment was made during the build). Browser near-view inspection confirmed varying silhouettes and matching runs. Post-build main view reports 41 draw calls, 202 geometries and 20 textures versus the preceding 38 calls and 14 textures. The extra three calls and six small maps are the bounded cost of four binding styles; no claim of faster initialization is made. The observed cold build was 5.77 s with an 834 ms static-batching slice, so startup optimization remains open. Overall historical fidelity remains incomplete.

Final category-button check showed all four real books, all cabinet-frame corners inside the viewport and collision clear. Console showed only the existing Drawer.width deprecation.

### 2026-09-09 — Inset historical paper heads

The near-shelf review exposed uniformly solid leather-colored book tops. Added an inset paper head under a projecting cover rim, with a shared procedural leaf-edge texture. Dimensions and ageing are reconstruction estimates. The original solid bottom remains because books rest on the shelf; there is no individual leaf geometry or claim of an identified historical binding.

An initial through-opening with both paper head and tail raised main-view triangles to 9,993,236. Replaced it with a top-only rim and paper quad, removing hidden inner walls and lower paper. Final main view: 8,277,396 triangles (preceding turn 7,419,476), 42 draw calls (41 previously), 203 geometries and 21 textures. This is a fidelity cost, not a performance improvement over the preceding turn. Near-view browser inspection confirmed the inset head and projecting cover edge.

Final lint/typecheck, four structure/collision tests and build passed. Main view collision remains clear with 383 descriptors. Full frontend suite was not rerun; overall historical fidelity and startup performance remain incomplete.

### 2026-09-09 — Spatial binding LOD

Split scenery bindings into two-bay groups per side. At 18 m each group changes from curved bindings plus paper heads to twelve-triangle bindings with the same surface styles, dimensions, transforms and colors. A 12% hysteresis suppresses rapid threshold oscillation. Near/far meshes share instance attributes; static optimization preserves the LOD hierarchy. Real catalog models are unchanged.

Added regression assertions to the existing structural test for near/far selection after static batching, shared transforms, equal counts and reduced distant geometry. Lint/typecheck, four model tests and build passed; the tests were rerun after adding these assertions. Browser review retained the near shelf detail. Twelve forward-button interactions moved the camera from Z 41.599 to 23.599 with collision clear.

At the matching entrance view, triangles fell from 8,277,396 to 5,122,744 (about 38%), while draw calls rose from 42 to 119. Mid-hall after walking: 5,209,695 triangles and 100 calls. These are geometry/render statistics, not a controlled FPS or startup benchmark. Architecture still accounts for significant rendering work, and full reconstruction remains incomplete.

### 2026-09-09 — Moulded barrel ribs

Reopened [Dominik Gehl's axial Long Room photograph](https://dominikgehl.com/ireland/dublin/library-trinity-college), image 01. Its broad timber ribs show paired projecting mouldings and a recessed central face. Replaced each former three-tube assembly with one closed swept section, shared across the 21 transverse ribs. Width 0.40 m and maximum inward depth 0.185 m are estimates for the adapted envelope, not surveyed originals. The 96-segment semicircle is concentric with the barrel lining; both spring ends are capped. Wood UVs follow the arc.

Near review at model-review.html?component=vault-rib showed a continuous fascia, edge mouldings and lining contact. Main entrance view retained the repeated arch rhythm. Lint/typecheck, four structural/LOD/collision tests and build passed. Main view reports 5,091,412 triangles versus 5,122,744 previously, with 119 draw calls unchanged and collision clear. Overall historical accuracy remains incomplete; this is a photo-based section study, not proof of exact joinery.

### 2026-09-09 — Documented 2021 donor panels

Research found a [Trinity announcement dated 3 September 2021](https://www.tcd.ie/news_events/articles/trinity-welcomes-prince-albert-ii-of-monaco/) confirming Albert II's Long Room frieze unveiling. The [Palais Princier photograph reproduced by Monaco Life](https://monacolife.net/wp-content/uploads/2021/09/241342485_4798560456823122_4910044183740686943_n.jpg) visibly reads “HSH ALBERT II OF MONACO” between O and P, and “FRANCES & DENIS DALY” immediately alongside. This resolves two modern inscriptions, not the founding donors' Latin wording.

Added these two transcribed texts on green inset panels with timber fascia and rounded frame beads. Relative adjacency is photographic; north-side adapted bay centers 13/14 remain an inferred placement because the complete stall sequence and measured coordinates are unresolved. The lettering/font and dimensions are estimates. The implementation follows the 2021 stocked-library reference, not the present conservation interior. No photograph pixels were bundled as textures.

Near-view browser review confirmed readable orientation, correct two-panel order and connected framing. Lint/typecheck, four structural/LOD/collision tests and build passed. Full frontend suite was not rerun. Full Latin frieze reconstruction and overall historical fidelity remain incomplete.

### 2026-09-09 — Panelled gallery newels

Continued the Palais Princier 2021 near-gallery reference: solid framed piers interrupt the turned balusters. Added recessed timber panels and bevelled surrounds, necks and caps on the adapted bay boundaries; nearby slender balusters are omitted to avoid overlap. Both faces, dimensions and repetition remain estimates. Stair and end crosswalk openings exclude the new posts. Existing gallery guard thickness increased from 0.24 to 0.26 m to cover the moulding relief.

Near-view inspection confirmed the framed panel and handrail connections. Lint/typecheck, four model tests and build passed; complete structural/LOD/collision tests were rerun after the final guard-width adjustment and passed. In the live browser, entering stair mode and clicking forward 18 times reached walkDistance 36, floor 2, eye (6.55, 7.6, 10.085), collision clear. This manually verifies the ascent and initial gallery stretch; the full two-way route is verified by the regression sweep. Console retained only the Drawer.width deprecation. Full frontend suite was not rerun, and exact historical joinery remains incomplete.

### 2026-09-09 — Curved baluster turning profile

The close gallery review showed diamond-like straight tapers on the former nine-point baluster silhouette. Replaced these with monotone cubic radius curves sampled three times per interval, preserving the 0.78 m height, 0.07 m maximum radius, 20 radial segments, all positions and circulation exclusions. Timber UVs now follow metric height. The shared instanced meshes remain. The turning profile is a photographic approximation using the already inspected Palais Princier gallery view, not surveyed joinery.

Near-view browser inspection showed rounded bellies and neck transitions. Lint/typecheck, four structural/LOD/collision tests and build passed. Final matching entrance view reports 5,585,992 triangles versus 5,060,552 previously, with draw calls unchanged at 121; collision clear and four catalog models present. This adds 525,440 triangles for the curved silhouette, not a performance improvement. Full frontend suite was not rerun. Overall exact reconstruction remains incomplete.

### 2026-09-09 — Runtime/source data reconciliation

Reopened the official 2012 architectural-history page and confirmed its published 63.7 x 12.2 x 14.2 m dimensions and 40 alcoves. Corrected stale adapted floor area (1647 to 2007 square metres), area ratio, window sill/height records (lower 1.25/3.85 m; upper 6.65/4.25 m), obsolete live-sculpture placement status and outdated prose. Added a source-derived runtimeSnapshot, while retaining original source-scale candidate values with explicit non-runtime scope. Rewrote the completion matrix to reflect current implementation and unresolved evidence. Asset inventory still exposes only the older oil-lamp, armchair and chandelier models under web public assets, not a Long Room scan.

Found that lower-case section metadata still claimed 15 shelf rows despite the reduced geometry and 120 slots occupying 10 rows. Corrected shelfRows to 10. Expanded the existing structural test to fill one case with 120 books and assert metadata agrees with all occupied rows. Final model regression passed, along with lint/typecheck/build. JSON arithmetic/source-ID validation passed. These checks do not prove measured architectural fidelity or completion.

### 2026-09-09 — Upper gallery ladders and size ordering

Research into the absent window-wall hinged cases found the official [Library Guard article](https://www.visittrinity.ie/blog/5-surprising-facts-about-the-book-of-kells-and-old-library/) (published 19 September 2024), including Barry McCall's upper-gallery photograph. The image clearly shows leaning ladders on upper transverse cases; the text explicitly states large books below and small books above. Added 39 estimated upper-ladder placements (excluding south entry stair bay), reusing the lower-ladder construction with appropriate height and gallery base. Added collision descriptors. Historical scenery now uses decreasing row-average format height instead of a repeating height cycle. Catalog slots remain unchanged.

The hinged cases are now documented as fixed wall shelves plus wheeled/hinged double-sided units, but precise geometry, locations and surviving count remain unresolved. The 2012 architectural history, Director's Choice catalogue article and 2024 Guard article establish the mechanism but do not establish a measured model; their qualitative surviving-count descriptions differ. No generic repeated window cabinets were added.

Near-view inspection from inside an alcove showed the complete upper ladder, feet on the gallery and clear walking strip. Lint/typecheck, four structural/LOD/full-route collision tests and build passed. Main view reports 422 collision descriptors, collision clear, and four real catalog models; console retains the existing Drawer.width deprecation. No ladder climbing interaction was added. Overall reconstruction remains incomplete.

### 2026-09-09 — Planning-source exclusion and live category review

The council's indexed [week 20 planning list](https://www.dublincity.ie/sites/default/files/2024-05/area-1-planning-lists-week-20-2024.pdf) identifies application 3701/24 as continuation of the temporary suspended globe exhibition under 3678/23. It is not evidence for existing pavilion dimensions. The related July decision-list URL returned 404 on direct retrieval. No measured plan or section was obtained from this search, and no geometry was altered on its basis. The 2023 CONUL presentation by Susie Bioletti and Laura Shanahan was located on SlideShare, but its extracted text does not establish surveyed dimensions; its illustrated slides need separate inspection before architectural use.

Rechecked the live 1280 x 720 route: the hall has visible wall lamps and clear central floor, without repeated statues or central display tables. Clicking the real literature category focuses all four catalog books and frames the full cabinet. The four cabinet corners are within normalized screen bounds (x +/-0.330, y -0.923 to +0.846); camera collision is clear with 422 descriptors, and the page has no horizontal overflow. This is one desktop viewport and one occupied category, not broad responsive/catalog acceptance. Runtime reports a 399.2 ms longest construction slice and 4286.5 ms world construction time in this session; responsiveness is therefore still an unresolved performance item despite idle rendering and LOD. These are observed session figures, not a controlled benchmark.

### 2026-09-09 — Source-informed access stair joinery and tread support

Located the Trinity CRAFTVALUE research project's [stair construction article](https://craftvalue.org/woodwork-staircases/) and Andrew Tierney's [comparative staircase analysis](https://craftvalue.org/trickyjunctions/the-staircase-at-damer-house/). Visually inspected its explicitly identified [Old Library staircase photograph](https://craftvalue.org/wp-content/uploads/2021/12/TCD-staircase_AT-1.jpg), showing slender fluted columns over square lower blocks, turned collars, a broad moulded handrail and projecting tread edges. The construction article identifies an open string with returned nosings and hidden baluster dovetails. The embedded construction animation was located but not inspected. Do not attribute the article's Damer House photographs or all of its carving descriptions to Trinity.

The previous adapted access stair used square rods placed on a continuous slope, which left their bases inconsistently related to individual treads. Replaced those with 142 shared instanced fluted balusters: two per tread on each side, plus the rest-landing balusters. Each base now sits on an actual tread/platform; height adjusts to meet the sloping handrail. Replaced pipe handrails with rounded crown/shoulder/bead sections, cylindrical stringers with rectangular timber members, and added rounded tread noses. All profiles and dimensions remain estimates. The original photographed stair belongs to the west pavilion; the live north-side route remains the user-requested enlarged-hall adaptation, not a claimed original placement. Original west-pavilion layout, newel carving and exact measurements remain unresolved.

Added regression checks against actual tread/platform geometry for every baluster base. Lint, typecheck, four model tests (including complete two-way circulation sweep) and build passed. Near-view browser review at `model-review.html?component=access-joinery` confirmed connected bases and shaped rails. Live ascent reached floor 2, eye (6.55, 7.6, 11.084) during travel, collision clear with 422 descriptors and four real catalog models. Only the existing Drawer.width deprecation was recorded. Full frontend suite was not rerun. This adds geometric detail; no performance speedup is claimed. Overall reconstruction remains incomplete.

### 2026-09-09 — Original west-pavilion source drawings: existing versus proposed

Downloaded the complete open-access [Enriching Architecture](https://discovery.ucl.ac.uk/id/eprint/10162056/) from UCL Discovery (398 PDF pages, 70,727,252 bytes). In Andrew Tierney's chapter, rendered and inspected printed pp.325-326 / PDF pp.360-361: Figure 11.8 photographs the existing Old Library stair; Figure 11.9 reproduces a historical completion proposal. The accompanying text explicitly identifies the proposed concave ramp and terminal volute as unexecuted. These cannot replace the existing swan-neck ramp and outward lower sweep. Note 16, printed p.349, points to TCD Mun P2 28, an undated unsigned estimate. The publication establishes wall-treatment evidence, but its illustrated drawing does not supply a complete measured plan.

Melanie Hayes's [2015 thesis](https://www.tara.tcd.ie/bitstreams/be6da7f9-b862-46a0-9fe5-93e8dda7ce5b/download), printed p.145 / PDF p.153, locates the original west-pavilion stair immediately inside the entrance and its upper landing directly outside the Long Room doorway. This establishes adjacency, not flight orientation or dimensions. The [LibViz research paper](https://visvar.github.io/assets/pdf/ruhland2009ijac.pdf), section 3, describes a model assembled from laser-meter measurements and image estimates because accurate plans were unavailable to that project. It supplies no usable measured model in this inspection; the legacy project URL did not load.

Added `westPavilionEvidence` and three source records to the public dataset, including explicit exclusions for unbuilt proposals and unresolved dimensions. Corrected the completion audit's stale collider count from 383 to the last verified 422. JSON and source IDs validated. No runtime geometry or UI changed in this research turn, and no new browser or frontend test pass is claimed. Next architectural work should use the existing-condition photograph and documented wall treatment, with the historical proposal retained separately; original plan/section reconstruction remains unfinished.

### 2026-09-09 — End-wall carved shafts and coplanar vestibule correction

Replaced the eight end-wall shafts' surface-applied dark bars with real recessed flute geometry and substituted estimated foliate capitals for plain blocks. This extends the existing Long Room joinery study to the photographed end-wall composition; it is not a newly measured end-wall elevation. Door panels, rails and stiles now use dimension-based wood grain orientation. Original end dimensions and individual carving details remain estimates; neither the removed sculptures nor an invented pavilion plan were added.

East near-view inspection exposed bright vertical and horizontal stripes outside the portal. The painted vestibule north wall and ceiling had front caps exactly coplanar with the timber end wall. Set those caps 0.08 m behind the end plane while preserving their rear extent. The same browser view confirmed the stripes disappeared and the actual doorway remained open.

Added geometry checks for deeper flute hollows at both ends and a positive setback for the painted vestibule caps. Existing door/niche ray checks and full circulation/collision tests pass. Lint/typecheck, four model tests and build passed. Both east and west review views were inspected; the main browser console retained only the existing Drawer.width warning. Full frontend suite was not rerun. See `endJoineryConstructionStudy` for estimates and remaining scope. Overall exact reconstruction is still incomplete.

### 2026-09-09 — Bounded static geometry batches and progressive builder scheduling

Static merging now limits each combined batch to 65,536 vertices, yields during preparation by object count and vertex weight, and leaves individually oversized meshes untouched. Late architectural builders now yield separately. No model detail was removed. Added regression coverage for batch limits, preserved triangle counts, world bounds and ray hits, and untouched oversized geometry.

The local zero-catalog performance review recorded a single before/final comparison: longest static merge slice 124.3 to 8.3 ms, longest construction slice 185.5 to 71.2 ms, with 6,639,716 visible triangles unchanged. Draw calls increased from 131 to 170; total review construction increased from 2423.1 to 2691.4 ms. These measurements demonstrate shorter blocking slices, not faster total loading or improved GPU frame rate. See `batching-performance-samples.json` for complete samples and limitations. The authenticated main route separately still recorded a 178.6 ms construction slice and 4309.8 ms world build; review timings must not be substituted for main-route performance.

Lint, typecheck, nine focused tests across three model files and build passed. Full frontend suite was not rerun. Browser validation with four real catalog books confirmed full cabinet framing, then actual forward movement reached floor 2 at route distance 36.00, with collision clear and rendering idle. The console retained the existing Drawer.width deprecation. An early category click during an HMR scene rebuild exposed a stale-handler/loading race; this remains unresolved and is a next interaction fix. Overall architectural reconstruction remains incomplete.

### 2026-09-09 — Category requests during asynchronous scene construction

Replaced the category callback ref with a deferred action that retains only the latest request while no scene handler is attached. The handler attaches after shader compilation and detaches synchronously when the scene effect cleans up, preventing disposed-world calls. New builds reset stale shelf selection UI and start with loading visible. The queued request executes before the new render loop starts. This fixes early category requests; it does not queue all navigation controls or preserve arbitrary camera position across catalog rebuilds.

Regression tests cover competing early selections and detach/rebuild sequences. Lint/typecheck, five focused deferred-action/page tests and build passed. In the actual browser, left the route and returned, clicked literature while the loading indicator was still visible and no frame had rendered, then observed literature focus with four books after loading ended. Full cabinet bounds remained within the view and collision was clear. Console retained only Drawer.width deprecation entries. Full frontend suite was not rerun. Architectural reconstruction and remaining performance work are still incomplete.

### 2026-09-09 — Paneled lower window returns

Reopened and visually inspected Dominik Gehl's [lower alcove photograph](https://dominikgehl.com/ireland/dublin/library-trinity-college), image 02. The window return shows pale framed rectangular recesses behind the ladders. Added photo-estimated three-field splayed frames with actual recessed backing panels and small beveled edges, plus a head lining and rear closing stiles. One shared template is cloned to both returns of the forty lower windows. No shutter movement or measured historic paint specification is claimed. Upper windows were not changed using this lower-window evidence. See `lowerWindowReturnStudy` for dimensions and repetition assumptions.

Near-view browser comparison exposed intersections with the old jamb/meeting rail, corrected by moving the return forward and adjusting the rear closing stile. Final inspection showed connected returns and no remaining dark intersection spots in that view. Main-route category focus still displayed four real books, 422 collision descriptors, clear camera collision and idle rendering. Console retained the existing Drawer.width warning. Exact building fidelity remains incomplete.

Final lint/typecheck, five focused window/model tests and build passed. The new ray test confirms recessed fields on both faces; existing model tests cover two-way gallery/stair collision. Full frontend suite was not rerun.

### 2026-09-09 — Historical binding palette contrast

Compared the previous window review with the already inspected [Gehl lower-alcove photograph](https://dominikgehl.com/ireland/dublin/library-trinity-college). Most old scenery bindings were strongly mixed toward parchment, producing near-uniform pale gray-yellow shelves under the current lighting. Replaced that blanket mixture with deterministically hashed dark-brown, oxblood, tan and occasional pale families. Matching sets retain their shared seed. Family weights are estimated visual parameters, not a measured distribution of the college's collection. Real catalog covers, scenery geometry, LOD and lights were unchanged.

The same window review now visibly separates brown and pale bindings; the actual main entrance view also shows varied bindings on both levels. Main category navigation still focuses all four real books, with 422 colliders, clear camera collision and idle rendering. Console retains the Drawer.width deprecation. Lint/typecheck, four focused model regression tests and build passed. Full frontend suite was not rerun, and no performance gain or item-level historic fidelity is claimed. Overall reconstruction remains incomplete.

### 2026-09-09 — Abbott's historical stair illustrations and fragment-model scope

Located T. K. Abbott's Library chapter in the college's 1892 tercentenary volume. Browser-inspected printed p.180, “Library Staircase and Entrance to Reading Room,” and p.177, “Inner Staircase in Library.” The former shows the broad lower sweep, turning landing, rising upper flights, rusticated walls and a doorway below the upper flight. The latter shows successive timber flights and landings with paneled soffits. Despite its caption, it must not be mistaken for the circular iron staircase. These add perspective evidence to the previous close photographs; neither is a measured modern plan.

Opened and played CRAFTVALUE's 34-second “Staircase model” video. It presents a short reconstructed timber stair section and curved termination, not the complete pavilion. The publisher's 3D CRAFT search result also explicitly describes a section model. Recorded source links, image captions, observations and exclusions in `westPavilionEvidence`. The same historical book's Portland-stone/Moorish-arch description belongs to the Engineering/Museum building and was excluded. The Richview Mapping movement-study caption did not yield a measured plan in this retrieval.

No runtime geometry changed in this research turn; no new build or interaction pass is claimed. Next pavilion reconstruction should correlate the two historical viewpoints with existing-condition photographs to resolve flight turns and door adjacency, while dimensions remain explicit estimates. Overall reconstruction remains incomplete.

### 2026-09-09 — West stair topology component study

Added `longRoomWestStairStudy.ts` and an isolated `model-review.html?component=west-stair` view. The component explores three flights and two quarter-turn landings around a well, based on the historical perspectives. This topology is a hypothesis, not a surveyed plan. All numeric values are estimates: 5.4 m rise, 12/8/12 risers, 0.32 m going and 1.6 m width. Local axes deliberately carry no compass orientation.

The draft contains closed risers, continuous timber undersides, 64 shared fluted balusters placed on individual treads, an arrival platform and a lower-wall rustication fragment. It does not yet include the curved start/ramp, full enclosure, landing support structure, outer/platform guards, door connection, collision or walking integration. It is absent from the live hall. See `westPavilionStairTopologyStudy` for remaining requirements; this component is not a completed original staircase.

A ray-based test verifies every baluster foot is on a tread and a sampled candidate centerline climbs continuously through both landings to the arrival level without a rise above 0.18 m. The first typecheck exposed an overbroad material fixture type; the builder now accepts only its five required materials. Final lint/typecheck, the dedicated support/path test and build passed. Complete component framing was visually checked and the review console had no errors. No main-route or full frontend-suite pass is claimed for this isolated study.

### 2026-09-09 — West stair starting sweep and supported balusters

The isolated west-stair study now uses a continuously swept moulded handrail on its first flight. A cubic outward displacement tapers to the straight run over the first four treads; an added height offset gives the beginning a level tangent before it joins the raking rail. This follows the existing outward-sweep evidence, without adding the unexecuted terminal spiral from the historical proposal. The numerical sweep, rise and transition remain estimates. Shared handrail profile extraction leaves the live adapted access rail shape unchanged.

The lower treads and risers widen to support the shifted balusters; each baluster height follows the raised rail. Tread front corners now use curved geometry. The dedicated test additionally casts rays at the tops of all first-flight balusters to verify that they meet the actual swept handrail, while retaining foot support and centerline continuity checks. Full-study and start-detail browser views were inspected. The starting termination, landing ramp joins, full enclosure and door connection remain unfinished, and the study is still absent from the live hall.

Validation: lint and five focused tests passed before the final tread-corner change; after it, the dedicated physical support/join test and targeted lint passed again. Fixed the Curve subclass constructor visibility and the box helper return type exposed by typecheck. Final typecheck and build passed. No full frontend-suite or new live navigation pass is claimed.

### 2026-09-09 — West study arrival guard and turning caps

Added a guard along the arrival platform's exposed well-side edge, short end returns around a provisional exit, and supported turning newel studies with beveled caps bridging the flight-rail offsets. The nominal distance between end-rail endpoints is 1.04 m; projecting profiles reduce actual clear width. This is a circulation hypothesis, not evidence of the original door width. Outer enclosure and guard coverage remain incomplete. Full curved historic ramp joinery is not replaced by these temporary caps.

The dedicated geometric test now checks platform baluster/newel foot support, an unobstructed center exit ray and a ray that meets the well-side top rail, alongside existing first-flight rail joins and walking-surface continuity. The whole study was visually inspected; the arrival guard is visible and the study remains isolated from the main route.

Lint/typecheck, the expanded dedicated geometry test and build passed; the component review console had no errors. These checks do not establish complete guard coverage, code compliance, measured architectural fidelity or live navigation. Full frontend suite was not rerun.

### 2026-09-09 — West stair enclosure and real threshold apertures

Added `longRoomWestEnclosure.ts`: continuous walls with lower and upper door holes, shallow applied plaster rustication, timber opening surrounds and a ceiling. Full enclosure is available at `model-review.html?component=west-stair-room`; the existing stair view retains a cutaway. A bridge joins the top platform to the candidate upper threshold. Wall centers, room height and door positions are explicitly unmeasured working parameters in `enclosureEstimate`, not a reconstructed survey. The existing source only supports general doorway/stair adjacency and wall-treatment character.

Cutaway and interior browser reviews were inspected. The interior view exposed door jambs partly hidden behind raised rustication faces; their depth was corrected to clear the finish. The final view shows continuous door jamb/head edges. New ray checks confirm lower and upper doorway centers are open while adjacent wall points are solid; sampled downward rays verify top-platform-to-threshold support. The component still lacks source-matched upper paneling, frieze, windows, landing structure and live navigation integration.

Lint/typecheck and build passed; both dedicated study tests passed and were rerun successfully after the jamb-depth correction. No full frontend-suite or live-hall interaction pass is claimed. Overall exact reconstruction remains incomplete.

### 2026-09-09 — West stair frieze character and further ceiling evidence

Browser-inspected both photographs in [The Irish Aesthete, A Hidden Gem (2019-11-02)](https://theirishaesthete.com/2019/11/02/tcd-library/). Both depict the rococo ceiling; the wider photograph also includes surrounding timber guards. The article describes stairs on three sides of the double-height space, supporting the general study topology but not its exact flight counts, dimensions or door positions. The cropped Casey 2018 photograph does not by itself identify which upper door connects to the Long Room. Keep provisional door adjacency explicit.

Added a simplified curved-scroll plaster frieze and profiled ceiling cornice to the isolated enclosure. The interstorey scroll-band character follows Tierney's textual identification; the new ceiling photographs are recorded for later ornament work and were not misrepresented as this wall-frieze design. Band height, spacing, relief and molding profile are estimates. Repeated curls share instanced geometry; the plain cornice omits unnecessary curl construction. The enclosed review visibly shows curved relief and shadow, with no review console errors. Acanthus panels, rococo ceiling ornament and precise joinery remain unfinished; this study is absent from the live hall.

The main route was separately inspected: category-button navigation framed the whole case with all four real books visible, and the entrance showed modeled lamps, the curved barrel vault and the widened aisle. A subsequent DOM diagnostic (after build token generation, with the dataset back at the entrance state) reported 422 colliders and idle rendering, but also an 11.61 s world build and 3.29 s longest construction slice. These are single observations under this session's load, not a controlled benchmark; they do not justify declaring performance solved. Main console still reports the existing Drawer.width deprecation.

Validation: lint, typecheck, both west-stair geometry tests and build passed. No full frontend-suite pass or performance improvement is claimed. Overall reconstruction remains incomplete.

### 2026-09-09 — Binding textures and repeated ladder construction

The previous main-route construction-116 spike was not reproduced in a fresh zero-catalog performance review: it measured 55.4 ms, with shelf ladders at 80.5 ms. Inspected the responsible source: four binding maps were generated synchronously with a bands.map allocation at every pixel, while identical ladder hooks and feet were reconstructed for each placement.

Binding generation now computes band distance once per row and exposes a generator that yields every 16 rows. The synchronous builder drains the same generator. Four color/relief texture pairs retain their exact pre-edit SHA-256 values in regression tests. Ladder feet, hanging rails and brackets share geometry, hooks share a geometry per level, and ladder placement yields per bay. No detail segments, placements or collision descriptors were removed. The scene scheduler groups cheap construction steps within an 8 ms task budget to avoid a separate timer delay for every tiny step; this is a scheduling target, not a guaranteed upper bound for indivisible work.

Fresh browser observation: binding-texture slices peaked at 1.3 ms and ladder slices at 1.1 ms. Source mesh count 12,137, batch count 62, draw calls 172 and 6,665,156 triangles matched the baseline. The full entrance view remained visually intact and the performance review console had no errors. Total elapsed time was similar (2.999 s before / 2.953 s after), and the maximum construction slice was worse (80.5 / 86.9 ms). These samples establish targeted splitting, not a general speedup or resolution of all loading problems. See binding-loading-samples.json.

Main-route verification: the literature category framed all four real books; DOM reported 422 camera colliders, clear collision, the literature category and idle rendering. The existing Drawer.width deprecation remains. The cancellation regression now checks that queued navigation aborts before any further construction work, rather than assuming exactly one stage per task.

Final validation: lint, typecheck, six focused model/surface/cancellation tests and build passed. The initial tests exposed typed texture-data handling and the obsolete one-stage-per-task cancellation assumption; both were corrected before the successful run. No full frontend-suite pass is claimed. Architectural reconstruction remains incomplete.

### 2026-09-09 — West stair upper wall-panel character study

Reopened the locally rendered Casey 2018 printed p.26/PDF p.28 photograph. It clearly juxtaposes a narrow plain plaster frame with a wider lugged frame carrying foliate decoration. Added those two panel types to the estimated west-stair enclosure, with a separate upper-wall view at `model-review.html?component=west-stair-panels`. The wider panel uses a stepped lugged outline, a beveled outer molding, a recessed secondary bead, curved stems, inward volutes and scalloped leaf surfaces. The field remains open to the continuous plaster wall behind it. Photo-derived character is distinct from measured or traced carving: dimensions, repetition across walls and detailed leaf anatomy remain estimates.

The initial leaf crest was too thin and sparse in the browser review; its leaves were widened and curved further forward, and inner volutes were added. Final upper-wall review shows the two frame types and visible relief. The front-wall panel is shifted clear of the provisional upper doorway. Door adjacency itself remains unproven. The study is still separate from the live hall, and the rococo ceiling, windows, structural landing details and exact wall-carving profiles remain incomplete.

Validation: upper-wall and full interior browser views were inspected; the upper-wall review console had no errors. Lint, typecheck, three focused panel/stair geometry tests and build passed. Panel tests verify open central fields, raised long edge profiles and finite geometry; existing stair tests retain door aperture and walking-support checks. No full frontend-suite or new main-route verification is claimed for this isolated study. Overall exact reconstruction remains incomplete.

### 2026-09-09 — West stair to Long Room threshold alignment

Checked the existing main west-end geometry, camera clamping and gallery walking path before integration. The original west stair reaches the Long Room from the level below, unlike the adapted access stair serving the upper bookcase gallery. A new isolated connection study translates the stair by (-2.08, -5.4, -51.92), aligning its upper threshold with the Long Room reference floor at y=0. A short enclosed joining passage bridges the remaining distance to the west portal. The translation, 1.3 m passage length, 1.04 m width and narrowed transition are provisional, not a surveyed pavilion layout.

The reused west-end builder has an explicit study-only open-door option. It omits the closed meeting stile and replaces the solid collision box with piers/head plus open-leaf colliders for that option. The live main hall retains its default closed west doors and existing collision behavior. This is physical junction preparation, not completed main-route integration or a fully navigable original stair.

Both doorway-side and upper-flight-side browser views were inspected. The initial lower camera was below the platform and obscured the exit; the review now uses the upper-flight eye height. A dedicated geometry test samples support across the top platform, threshold and short hall floor, verifies a clear door-center ray and camera sweep, and verifies that passage side walls stop lateral travel. The test uses non-canvas generated material maps for the headless environment. It does not validate the full downstairs room or historical adjacency.

Final validation: lint, typecheck, seven focused main-model/stair/connection tests and build passed. The connection review console had no errors. No full frontend-suite or live-main-route connection pass is claimed. The physical junction remains an isolated estimate awaiting full stair collision and navigation integration; overall reconstruction is incomplete.

### 2026-09-09 — Guided west-stair route and enclosure collision

Added a world-coordinate route from the short Long Room arrival floor through the joining passage, down all three west-study flights and their landing legs, to the stair foot at y=-5.4. The route retains explicit approach/departure legs at turns and does not cut across the open well. Camera eye height is 1.65 m above the interpolated stair slope; the physical tread surface differs by less than one 0.16875 m riser.

Enclosure wall segments and timber door surrounds now carry collision descriptors. Flight well-side guards and arrival guards use standing-body barriers, since the camera-eye collision representation would otherwise pass above a physically low handrail. These descriptors survive the review's static batching. They do not establish unrestricted off-path walking or a complete fall-protection audit.

The connection review now offers two real buttons for continuous guided descent/ascent at 2.4 m/s. The camera follows the route with collision resolution and reports distance, floor height and collision status through DOM diagnostics. The existing geometric test samples the route in both directions, checks floor support within 0.18 m, verifies unobstructed swept travel, and confirms that travel toward the well is blocked. The main route still retains its existing navigation and closed west doors; full integration remains outstanding.

Browser descent traversed the complete 20.12 m route after static batching and reached y=-5.400 with clear collision. The first endpoint view faced a nearby wall, so the bottom endpoint now looks back toward the stair; a repeated descent verified the corrected view.

Browser ascent then returned to distance 0.00 and floor y=0.000 with clear collision; review console errors were empty. Lint, typecheck and three focused geometry tests passed. The test suite covers the guided centerline, not unrestricted room walking or measured architectural fidelity.

Final build passed after the endpoint-view adjustment. No full frontend-suite or main-route walking pass is claimed. Overall reconstruction and main-hall integration remain incomplete.

### 2026-09-09 — Live west-stair integration

Joined the estimated west stair and enclosure to the main Long Room model. Main west doors now use the explicit open-leaf geometry and opening-shaped collision descriptors. The live connection omits the standalone review's short hall floor and terminates its threshold at the existing hall boundary, avoiding overlapping floor faces. The standalone review remains available for refinement. This supersedes earlier component-only status, but does not turn estimated dimensions or door adjacency into surveyed evidence.

The main control panel now offers “前往西楼梯”. Forward/backward use the tested west-stair route; “返回长厅” returns to the supported portal-side point facing into the hall. Category focus, catalog focus and upper-gallery access clear west walking. Stair-entry buttons are disabled during scene loading. Per-frame west-route travel is bounded before collision resolution, and the lower endpoint looks back toward the stairs. General free movement remains restricted to the original hall envelope; west-stair travel is guided, not unrestricted room walking.

The main model's collision count is now 478. Extended the post-batching main-model test to check both west-stair and upper-gallery routes in both directions. Updated former closed-west-door assertions to verify the new open portal and retained paneled leaves. An initial parallel test run timed out on the large model; an isolated rerun completed normally and exposed the remaining obsolete closed-door assertion, which was updated to the supported open connection.

Live browser validation: entered west walking from the main page, descended to floor y=-5.4 (eye y=-3.75), walked back to distance 0 and eye y=1.65, then used Return to Hall. The return point was (0, 1.65, -43.5), facing into the Long Room, with clear collision. Category focus from west walking retained all four catalog books; switching to gallery walking reported the gallery route. Leaving for the catalog and reentering restored the default hall view at z=41.599, four books, 478 colliders, clear collision and idle rendering. Console still reports the existing Drawer.width deprecation.

Full frontend test run completed: 245 passed, 1 failed across 72 files. The only failure is the existing auth/password-policy.test.tsx expectation for “保存并进入书库” while the rendered normal-password form exposes “保存密码”; no virtual-library tests failed. Lint and typecheck passed. The unrelated authentication test was not changed in this modeling work.

Final build passed. Live west-stair integration is complete within the guided estimated-layout scope; exact architectural reconstruction, window/ceiling/landing refinement and full off-path circulation remain incomplete. No production deployment is claimed.

### 2026-09-09 — Two-level visible lighting refinement

Rechecked the live enlarged hall and category focus against the latest user review. The current 90 × 22.3 × 18.45 m adaptation retains reduced bookcases, the continuous curved main vault, detailed window returns and no central display tables or generic statues. The literature category opens the shelf containing the four real catalog books; the complete lower cabinet is visible at the inspected desktop viewport. This is not mobile framing evidence.

Expanded visible brass/glass wall fittings from eight ground-level lamps to twenty across both levels, including rounded brass shade rims. A shared geometry/material template replaces repeated construction. Retained four real point lights and added no shadow maps; no measured global performance improvement is claimed. These fittings are an explicitly requested lighting adaptation, not surveyed Trinity fixtures. Browser screenshots verify both lamp rows. Category navigation still works. Console contains the existing Ant Design Drawer.width deprecation.

Lint and typecheck passed. Main model tests passed 4/4 on an isolated rerun; the earlier concurrent run hit the existing 15-second large-model test timeout. Full frontend suite was not rerun for this lamp-only revision; its previously recorded unrelated password-policy failure remains unresolved.

Final build passed. Rechecked category focus after the update: the full cabinet top and base remain visible, with the four real catalog models on the lower shelf.

### 2026-09-09 — West stair tread finish and timber dado

Reopened the local render of Christine Casey, Architectural Trinity, Trinity Today 2018, printed p.26 / PDF p.28. The photograph shows worn lighter tread tops, dark risers and balustrades, and raking timber wainscot continuing around a landing. It does not establish measured panel spacing or timber profiles.

Added a separate, subtle directional tread finish with metric face UVs, millimetre-scale relief and a roughness texture; retained darker risers and rails. Tread and landing geometry and heights are unchanged. Added raking framed timber dado to all three flights and level returns around the turning/arrival platforms. Dimensions and panel divisions remain estimates. The backing fills the modeled wall-side gap, and eight collision descriptors keep the camera out of the added woodwork. Full surveyed stair geometry, exact joinery, ceiling ornament and likeness reconstruction remain incomplete.

The component browser view confirms lighter tread tops and beveled raking panel surrounds. Three focused stair/connection tests pass after adding the dado and its collisions.

Live main-route descent reached the lower endpoint (distance 20.11 m, floor 下层, collision clear) with 486 colliders. Screenshot shows the new landing returns and tread finish. Reduced the initially too-pale tread tone after this visual comparison. Lint and typecheck passed. The earlier full-suite auth failure is not addressed by this change; no full-suite rerun is claimed.

Final build passed after the tone adjustment. The final component screenshot also confirms the continuous platform returns; the remaining yellow plaster lighting and simplified carving are visible fidelity gaps.

### 2026-09-09 — West stair plaster material separation

The prior live screenshot had uniformly yellow wall fields and raised details. Referencing the already inspected Casey 2018 stair photograph, separated the west enclosure from the shared book-paper material: neutral gray wall fields, lighter raised plasterwork/cornice and darker horizontal joint beds. Added small eased edges to the shallow rustication faces, retaining door cuts and the measured-by-model collision extents. The warm main-hall light rig is unchanged. Colors remain photographic estimates under different lighting, not calibrated material measurements.

Component browser view confirms visible gray fields and lighter panel/frieze relief. Stair, connection and panel tests passed 4/4. The change does not complete the ceiling ornament or precise carved leaf shapes.

The final main-route screenshot at west-walk distance 6.00 confirms gray wall fields and pale raised panelwork under the actual hall light rig, with clear collision. Equal-sized rustication faces share eased-edge geometry; the connection test passed again after adding this reuse. The carving silhouettes remain visibly simplified and are not considered complete.

Final lint and build passed. Typecheck passed, and the final build also reran TypeScript after the geometry reuse change. No full frontend-suite or architectural completion claim is made.

### 2026-09-09 — West pavilion ceiling relief layout

Reopened https://theirishaesthete.com/2019/11/02/tcd-library/ and viewed its first ceiling photograph in the browser. It shows four outward shell/cartouche compositions, diagonal trailing foliage, four small inner floral groups and an open centre. The new ceiling relief follows that arrangement, using shared curved leaf surfaces and scroll geometry. Neither the carving contours nor dimensions were measured or traced; the repeated shapes remain visibly simpler than the photograph. The model deliberately does not add a central lamp or filled medallion absent from this image.

Connected the relief to the actual full west-stair enclosure at the underside of its ceiling. Added model-review component west-stair-ceiling for an upward inspection. Its upward fill matches the main hall's existing floor-bounce approximation. A local reflected-light spotlight and one cached 1024-square shadow map now reveal the shallow relief; this is an illumination approximation, not a claimed historic fixture or calibrated daylight solution.

The initial visual pass was too flat/dark. After increasing leaf folds and differentiating the ceiling field slightly from the relief, the final component browser screenshot shows actual relief and open centre. Tests pass 2/2 for ceiling orientation, room bounds, open centre, below-ceiling visibility and the existing west connection. Main-route upward camera interaction and a global performance benchmark have not been run for this change. Overall 1:1 architectural fidelity remains incomplete.

Adding a cached shadow also exposed a resource-lifecycle gap: disposeScene did not dispose light shadow targets or separate bump maps. It now releases both, with a focused regression verifying shared bump texture disposal once and cached shadow target disposal on leaving the scene. That test and the ceiling geometry test passed 2/2.

Final lint and build passed, including TypeScript compilation. Browser navigation out to the catalog and back completed; the console reports only the existing Ant Design Drawer.width deprecation. No full frontend-suite rerun or global memory/performance measurement is claimed.

### 2026-09-09 — West ceiling perimeter ornament

Reopened the second Irish Aesthete 2019 ceiling photograph. Its lower edge confirms a repeated raised perimeter ornament, but the source resolution does not establish its precise section. Added repeated curved relief units on the existing continuous ceiling cornice, leaving clear space at the crossing wall projections. These unit profiles, spacing and foliation remain estimates.

The first extruded version read as square blocks in the upward browser view and was replaced with a rounded transverse surface and a leaf that follows it. The final component screenshot confirms rounded silhouettes and no visible corner interpenetration. Each wall uses instanced bodies/leaves sharing the same geometry across the four walls. No new light or shadow map was introduced. The detailed perimeter profile and original carving still require stronger source evidence/refinement; this is not a 1:1 completion claim.

Final related tests passed 2/2; lint, typecheck and build passed. Browser evidence is the upward component view, not a new main-route walk-through or calibrated lighting test. The known unrelated password-policy test failure has not been changed; no full-suite rerun is claimed.

### 2026-09-09 — West ceiling cartouche modeling

Compared the current thin scroll outlines with the already viewed second Irish Aesthete ceiling photograph. Replaced the principal and outer wire-like paths with tapered, folded ribbon surfaces. Added the small flower within each of the four main cartouches and a row of small inner raised ornaments, features visible in that photograph. These details are still schematic: exact lobed contour, ornamental anatomy and original dimensions remain unmeasured.

The upward component screenshot confirms all four cartouche flowers, modeled scroll bands and the preserved open room-centre field. Geometry is shared by the rotated main ornaments; the new inner beadwork is instanced. No new light or shadow map was added. Extended the underside ray check to cover the four cartouche flowers.

Final related tests passed 2/2. Lint, typecheck and build passed. Validation is the component upward view and geometry/connection regressions; no new full-route walking or full frontend-suite result is claimed. Precise carved contours and overall 1:1 fidelity remain incomplete.

### 2026-09-09 — West pavilion high-window hypothesis

The previously viewed Irish Aesthete 2019 ceiling photograph includes part of a high sash window. The enclosed study had no window opening. Added a provisional 1.55 × 3.25 m opening at local base y=4.5, centred above the lower doorway on the rear wall. This placement, pane count and size are hypotheses, not positions established by the ceiling photograph. The rear central wall panel is omitted where the window occupies its field; adjacent narrow panels remain.

Wall construction now partitions around both door and window apertures rather than hiding a pane over an unbroken wall. Added timber jambs, recessed sash rails, plaster reveals, sill and diffused exterior pane. Glazing has camera collision and does not cast an opaque shadow. A window-directed light adds one cached 1024-square shadow map; its energy/direction remain a daylight approximation.

The component browser view confirms a visible opening and separated joinery. Two tests pass: the first visible surface through the aperture is the pane, the lower door remains open, glass blocks camera escape, and the existing guided stair connection still passes. Exact pavilion plan, window section and calibrated daylight remain unresolved.

Main browser view at west-walk distance 6.00 confirms the high window is visible in the integrated pavilion, with clear collision and 504 total camera colliders. Lint, typecheck and final build passed. The screenshot verifies presence and framing, not physically calibrated daylight or an exact historic window location. No full frontend-suite rerun is claimed.

### 2026-09-09 — Pavilion plan evidence pass

Located and inspected the public Trinity Women Graduates architectural presentation, published 2021-12-08. The 20:11 frame shows labelled Gallery/Long Room/Ground Floor plans, including a stair beside room 9 at one end. Inspected adjacent historical slides and independently verified that the Fagel room belongs at the east end. Detailed provenance, timestamps, current-code comparison and remaining ambiguities are in pavilion-plan-evidence.md. No numerical geometry change was made from an unscaled video frame. Updated the completion audit and corrected its stale collision count to the previously verified 504.


### Pavilion archival provenance follow-up

Added structured `westPavilionPlanEvidence` and source entries for the 2021 presentation, Lüttmann 2024 and the Irish Architectural Archive catalogue. The developed stair drawing is identifiable as TCD MUN/MC/26, linked to estimate MUN/P/2/28; IAA lists a photograph at 86/6.2/1. Rechecked *Enriching Architecture* p.326 to preserve the distinction between proposed and executed handrails. Full thesis figure access remains unavailable; room 9, scale and door topology remain unresolved. No runtime geometry changed and no new test/build result is claimed for this research-only pass. Details: `pavilion-plan-evidence.md`.


### West stair starting column

Reinspected Tierney's existing-stair photograph, fig.11.8 / printed p.325. The former first slender baluster did not represent the substantial starting column. Added a dedicated tapered round newel with layered collars, a square plinth with softened corners and an abacus joining the outward-swept handrail. It replaces one thin baluster; no proposed terminal volute was introduced. Dimensions remain photographic estimates. Turning newels and landing swan-neck ramps remain incomplete.

The support test checks all four plinth corners against the actual tread surface and ray-tests the top against the swept handrail. West stair/connection tests: 3 passed in 2 files. Lint, typecheck and build passed; component near view visually inspected. Build retains its existing large-chunk warning. Full-suite status is not superseded by these targeted checks.

Main-route check after the newel change reached west walk distance 20.12/20.12, lower floor, camera collision `clear`, 504 descriptors. The bottom-of-stair view was inspected. The inspected console entries contained the existing Ant Design Drawer `width` deprecation warning; no model exception appeared in that sample. This confirms the guided descent remains usable, not unrestricted pavilion navigation or measured fidelity.


### West stair oak finish and grain alignment

The main stair close view showed coarse, high-contrast streaks across the dado and rail. The prior material inherited the hall wood map and 0.018–0.025 m bump scales; the review and live scene could use different loaded maps. Added shared west-specific subtle albedo/relief/roughness textures with a 0.0006 m bump scale and separated panel, polished trim and shaded-soffit material variants. The 128×256 maps are shared across these variants. Albedo is encoded in sRGB; relief and roughness stay linear.

Mapped raking dado moldings along the slope and vertical panels along their height. Split surrounding frames into rails and stiles to preserve timber grain direction at joints. The outward-swept handrail now uses coordinates relative to its curve, and box risers use their long board axis. Component near view inspected after the change. Targeted stair, connection and disposal tests: 4 passed in 3 files. Lint, typecheck and build passed. Build still reports its pre-existing chunk-size warning; no full-suite success is claimed. Surface appearance remains photo-estimated, not calibrated material capture.

Live main-route follow-up: west descent reached 20.11 m of the 20.12 m route (rounded camera interpolation), lower-floor eye height -3.750 m, collision clear, 504 descriptors. The same bottom-of-stair view was inspected and the coarse wood streaks are no longer present after batching. The inspected console sample contains only the existing Ant Design Drawer width deprecation warning. This is a material and guided-descent check, not complete pavilion fidelity.


### West stair landing ramps

Replaced straight flight-to-landing rail transitions with photo-estimated swan-neck rises. Each incoming rail now has a horizontal tangent at the landing junction; outgoing rails begin horizontally and recover the flight slope. Final arrival flattens into the existing upper platform guard. Estimated transition length is 0.8 m and intermediate landing lift 0.28 m. Turn supports follow the increased rail height; rounded lathed junctions replace the earlier square caps. This reproduces the observed type of transition, not a measured carved profile or the unexecuted historical concave ramp/terminal volute.

All flight baluster heads are checked against actual lower and upper rail intersections, replacing a fixed vertical-thickness tolerance that is inappropriate on steep ramps. Head endpoints remain within the rail rather than separated or above its crown. Tests also verify monotone rise, level landing tangents, foot support and route continuity. Four tests passed in the two west stair/connection files; lint, typecheck and build passed. Reviewed both the starting flight and the new `west-stair-turn` close view. Main-layout and exact historical joinery gaps remain.

Main-route intermediate check reached west walk distance 14.00 m with collision clear and 504 descriptors. The inspected console sample showed only the existing Ant Design Drawer width deprecation warning. The ramp shape was assessed in the dedicated start/turn component views; this intermediate main camera faced the wall, so it is circulation evidence rather than a matched photographic ramp comparison.

The subsequent descent reached 20.11/20.12 m, collision clear. The bottom view now visibly includes the raised incoming ramp and flattened outgoing join in the live scene. Component and live visibility are verified; precise carved-junction fidelity remains unproven.


### West pavilion progressive construction

Live diagnostics identified `construction-west-pavilion` as a 138.0 ms uninterrupted stage (world build 3047.3 ms in that sample). Split stair materials, flights, landing linings/guards, enclosure walls, ceiling relief and hall portal into yielding generator stages. The existing main builder's task-budget and abort check now run between them. Component/offline functions synchronously drain the same generators, retaining the geometry.

After the change, west-stage maximum was 31.4 ms during concurrent test activity, then 23.5 ms after leaving and re-entering the live route. Total world build was respectively 7641.7 and 5658.2 ms: do **not** claim overall startup improved. Other long pauses remain (`static-batching` 1251.4 ms in the busy sample; `construction-30` 602.7 ms and finalization 779.8 ms on re-entry). These individual observations are not controlled performance averages. Detailed numeric records are in `public-reference-data.json.westConstructionScheduling`.

The four west stair/connection tests passed. Full model validation initially hit its existing 15-second timeout during concurrent execution; the isolated `--maxWorkers=1` rerun passed all four tests in 7.99 seconds total. No timeout was increased. Lint, typecheck and build passed. Main route retained 504 camera colliders and accepted west-stair navigation. No reconstruction-fidelity gap is closed by this scheduling change.


### Static batch temporary geometry lifetime

The former grouping pass cloned every eligible source before merging any batch. This allowed all transformed copies to coexist even though each eventual merged buffer was capped. Grouping now records sources only. Each merge constructs at most one bounded batch of transformed copies, disposes them in `finally`, and clears completed source/copy reference arrays. Single-mesh groups are left untouched without cloning. Container inverses are computed once per batch instead of once per mesh. No architectural geometry is reduced.

A regression test instruments actual geometry clone/dispose events and verifies the live transformed-copy vertex total never exceeds 65,536 and returns to zero. Optimizer plus full model tests: 7 passed. Lint, typecheck and build passed. Existing geometry/placement and circulation assertions continue to pass.

After leaving and re-entering the main route: 209 draw calls, 7,209,714 visible triangles and 504 camera colliders, matching the prior entrance sample. World build 5831.3 ms, finalize 25.7 ms, shader compile 207.9 ms. A static-batching slice still reached 893.0 ms. Do not infer total heap savings or an overall speedup from this sample; only bounded transformed-copy lifetime is established by the regression test. Long batching pauses require further phase-level diagnosis. Bay construction yields now carry explicit side/bay labels instead of anonymous stage numbers.


### Static batching phase boundaries and cancellation

Split progressive optimization diagnostics into world-matrix update, traversal, grouping, copy-transform and merge-attach. The copy-transform boundary yields while temporary geometries remain owned by `try/finally`; cancellation before merge disposes them without removing the source objects. Cheap phases share an 8 ms task budget to avoid a timer delay for every tiny phase. The geometry construction and merging algorithms retain their output contract.

Added an abort-after-copy regression test, checking both copy disposal and untouched source geometry. Optimizer tests passed. Combined optimizer/model validation encountered two full-model timeouts during high renderer load (observed Codex renderer approximately 434.5% CPU and 2.6 GB RSS). After navigating out of the live scene, the isolated full model file passed all four tests in 7.61 seconds. No timeouts were increased. Lint, typecheck and build passed. The main route was then restored for a separate performance observation. Incomplete concurrent timing snapshots are not evidence of improved latency.

The loaded main-route observation before within-copy yielding took 65,264.0 ms to build. Copy-transform accounted for 28,564.5 ms (maximum slice 969.5 ms); merge-attach accounted for 4,250.9 ms (maximum 864.5 ms). Output retained 209 draw calls, 7,209,714 visible triangles and 504 colliders. These timings were collected under high renderer load and do not demonstrate a speedup. The copy loop now checks elapsed time every 16 meshes and yields after 8 ms; this is a cooperative check, not a hard upper bound on an individual operation. After this final change, all four optimizer tests, lint, typecheck and build passed.

Post-change main-route sample: world build 101,050.1 ms, 603 copy-transform slices totaling 36,810 ms, maximum 1103.5 ms. Merge-attach maximum 821.5 ms. Geometry remained 209 draw calls / 7,209,714 visible triangles / 504 colliders at entry. The scheduler alone does not solve long operations or establish a speedup. Clicking the live literature category selected all four catalog books in section 0; shelf frame projected inside the viewport (X ±0.436, Y −0.923 to 0.846), camera collision clear. Main hall screenshot showed modeled lamps, continuous curved vault and no central display tables or repeated statues. Current console error query returned none.

### Avoid procedural reconstruction during static copying

Inspection of the installed Three.js BufferGeometry implementation confirmed clone() calls new this.constructor().copy(this). Static batching now uses a plain BufferGeometry.copy(source), avoiding temporary re-tessellation by concrete geometry constructors. Temporary bounds are cleared before matrix baking, since only the final merged geometry needs computed bounds. A regression test counts procedural sphere construction and compares every position, normal and UV value after rotation and non-uniform scaling with the former transform result. All five optimizer tests passed, including cancellation disposal and bounded copy lifetime. This removes proven redundant work but does not yet establish a main-route latency improvement.

Combined model validation initially had two timeouts under renderer load. After leaving the live scene, isolated full-model validation passed all four tests in 4.70 seconds (tests 3.47 seconds). Lint, typecheck and build passed. No test timeouts were changed.

Main-route post-change observation: build 69,180.9 ms; copy-transform total 13,607 ms, maximum 1365.6 ms; merge-attach total 7644.1 ms. Entrance output remains 209 draw calls, 7,209,714 visible triangles and 504 colliders. Literature category opens four actual catalog books; shelf projected bounds remain within viewport and camera collision is clear. Screenshot retains the complete cabinet. Console sample contained only existing Ant Design Drawer width deprecation warnings. This single loaded-host observation is lower than the prior 101,050.1 ms run, but is not a controlled speedup measurement and still exposes unacceptable long slices.

### Window-return inner moulding

Re-opened Dominik Gehl image 02 in the browser and inspected the pale side panels flanking the blind. Narrow inset mouldings are visible around the recessed fields; exact sections cannot be measured from that photo. Added double-sided rounded rebate bands to the existing three-field return (16 mm band, 5 mm bevel, working estimates). No source image is used as an app texture. The isolated `model-review.html?component=window-return` view shows continuous inset edges and narrow shadow lines under grazing light. Existing two-sided ray checks of recessed panels and raised surrounds passed. This does not resolve the broader window dimensional/material calibration gaps.

Validation after the rebate change: one window-return test and all four full-model tests passed (full-model file 27.94 seconds total). Lint, typecheck and build passed. The component was visually checked and retained for review; main route was reopened. No new whole-hall matched-camera verification is claimed for this small joinery change.

### Physically staggered sash construction

Replaced the shared-plane window grid and one backing pane with two closed nine-light sash frames at distinct depths. Each pane is inset behind its glazing bars; the lower sash sits 75 mm toward the room and its upper rail overlaps the upper sash lower rail in elevation. The 60 mm frame depth leaves physical separation between the two closed sash tracks. These are working joinery estimates, informed by the six-row grid and middle meeting rail visible through the blind in Dominik Gehl image 02, not measured historic sash dimensions. Two height templates are built once and reused across all windows. Glazing retains the existing opaque daylight material approximation.

Ray tests verify eighteen pane centers at their expected two depths, no empty meeting seam, and nonintersecting sash frame depth bounds. An angled `model-review.html?component=window-sash` view was inspected. No opening animation or physical glass transmission is claimed.

Validation: sash test and four full-model tests passed; model file completed in 9.70 seconds. Lint, typecheck and build passed. Component console returned no errors. Main route reopened after verification. This is a joinery integration change, not proof of completed window or whole-building fidelity.

### Static batching in a background worker

The progressive path now sends one bounded geometry batch to a module worker for independent buffer copies, matrix baking, merging and bounds computation. Original scene buffers stay attached until successful replacement; result arrays transfer back without another copy. Structured clone can preserve shared-array aliases across template instances, so each worker-side transform explicitly owns its arrays. Unsupported attribute layouts retain the synchronous path. Worker failure falls back on untouched sources; abort terminates the worker and disposes any prepared returned geometry.

Twelve targeted tests passed, including shared-template equivalence of transformed positions/normals/UVs/normalized colors/indices/bounds, owner-relative placement, failure fallback, in-flight abort, and full-model collision/circulation. Actual browser phase data recorded 83 worker batches, no fallback, dispatch 933.8 ms total (87.8 ms max), postMessage 130.7 ms total (12.8 ms max), merge-attach 194.8 ms total (25.6 ms max). World build was still 90,919.4 ms under changing host/test load. Worker completion counters report count only (zero duration), not worker CPU or wait time. This proves background dispatch is active, not that overall startup is fast.

Final worker revision lint/typecheck, 12 targeted tests and production build passed. Build token generation triggered another live reload; its 96,760.7 ms timing is not a controlled comparison. Category navigation subsequently selected literature section 0, full cabinet frame remained in view, collision clear with 504 descriptors. Focus view reported 247 draw calls / 7,372,508 visible triangles after the recent window geometry changes. Screenshot inspected; console sample contained existing Drawer width deprecation warnings. Full frontend suite is still running and already contains failures outside the targeted model files, so full-suite success is not claimed.

Full frontend suite completion: 251 passed / 6 failed, 73 passing files / 4 failing files, 596.05 seconds. Failing files: password-policy, AiSettingsPage, BooklistsPage and App. No virtual-library test failures occurred. These non-model failures are recorded without claiming all causes were established as pre-existing. The suite is no longer pending.

### Build-scoped pilaster geometry templates

The 80 pilasters formerly tessellated the same foliate capital independently, along with repeated fluted shafts. The hall builder now creates one capital template and one shaft geometry per actual height, then clones object transforms while sharing their geometry. Template ownership is scoped to a single build and its material set; no disposed global cache is reused on navigation. Independent side/height/position placement remains unchanged. No carving or vertices were simplified.

Pilaster validation: seven model/worker tests passed. The geometry-sharing assertions are scoped to the 80 hall pilasters, excluding eight end-wall capitals; all 80 shaft positions remain distinct, with one shared capital core geometry and two shaft geometries. Collision and circulation assertions continue to pass. No geometry simplification or overall startup improvement is claimed from these tests alone.

Final pilaster revision lint, typecheck and build passed. Main route completed in 54,008.1 ms, with 214 entrance draw calls, 7,323,954 visible triangles and 504 colliders. Entrance screenshot retained the pillar rows; selecting literature showed four real books and a complete in-viewport shelf frame with collision clear. Console sample showed only the existing Drawer width deprecation. This single observation is not a controlled timing comparison; startup remains too slow.

### Four transverse-case structural templates

Backboards, stiles, shelf boards and upper curved beams are generated once per side/level combination and shared through independent case objects. Each case is translated along Z, and its uniquely identified collision descriptor is expressed in the same local coordinate frame. Per-bay book seeds, catalog reservation loops, brackets and pilasters remain independently positioned. Templates are scoped to one build rather than stored in a global cache. No geometry resolution or architectural detail was reduced.

Final validation: seven related model/worker tests passed, followed by all four full-model tests including all 80 case positions, shared geometry and unique collision descriptors (5.09 seconds). Lint, typecheck and build passed. Main-route observation recorded 56,056.7 ms startup, 214 entrance draw calls, 7,323,954 triangles and 504 colliders. The selected literature category screenshot shows the complete cabinet frame, aligned shelves and four actual catalog books on its bottom shelf. No visible placement shift was found. This is not an established speedup against the prior 54-second run under changing host load; startup and overall fidelity remain unfinished. The earlier full frontend suite remains 251 passed and six failed in four unrelated files; their causes have not all been isolated.

### Shared bounds for historical volume instances

The near binding, distant binding and paper head previously each traversed instance transforms to build a sphere. One affine box calculation per variant now covers the union of all three source geometries; both LOD meshes receive independent copies of the resulting sphere, and paper heads use the union of variant bounds. Variant-level yields divide cluster construction. LODs attach before those yields so partial objects remain reachable by cancellation cleanup. Geometry, maps, matrix/color buffers and distance thresholds are unchanged. Conservative boxes can admit extra geometry near the frustum edge; reduced CPU work is not by itself evidence of improved complete startup.

Final five targeted tests passed in 7.15 seconds; lint, typecheck and build passed. Tests compare against independently transformed box corners and verify all three model vertex sets remain enclosed under rotation, nonuniform/negative scale and shear, including unused buffer capacity and empty batches. Main entrance and literature-focus screenshots show no obvious missing clusters; the complete focused cabinet and four real books remain visible. Focused view: 242 draw calls, 7,255,116 triangles, 504 colliders and clear camera collision. Console sample contains existing Drawer width deprecation warnings only. Startup was 84,954.0 ms, longest slice 1770.2 ms at construction-binding-batch-1:10-0. This is slower than the previous 56-second observation; host load was not controlled, so this does not establish an overall speedup or attribute the increase to this change. Full-suite status remains the separately recorded 251 passed/six failed; no new full-suite success is claimed.

### Circular upper-alcove soffits and rounded edges

Reopened Dominik Gehl’s [axial photograph](https://images.dominikgehl.com/images/ireland/dublin/library-trinity-college/library-trinity-college-01.webp) and window-bay photo in the browser. The side-bay soffit outlines and timber boards are visible, but these photos do not establish a measured arc radius. Replaced the former sine-wave approximation with a circular segment retaining the adapted bay span and estimated 0.48 m rise. Lining, sealed spandrels and a shared rounded inner edge now derive from the same curve; UV distance follows its arc length. The 35 mm bead radius is also a working estimate. Forty bead instances share one geometry. The alcove-vault component view shows continuous curves and rounded junction edges; this is not a complete matched-camera fidelity verification.

Validation: five arc/full-model tests passed in 9.60 seconds, including constant circle radius, spring endpoints, crown tangent, symmetry, 40 shared bead instances and existing circulation/collision checks. Lint, typecheck and build passed. The component console returned no errors. The main route completed loading and its entrance screenshot was inspected after the final build; no obvious junction gap was visible from that view. No measured section match or new performance acceptance is claimed.

### Coherent barrel-lining joints and surface

Inspection found two mismatched seam systems: the ceiling texture represented eight boards over 1.44 m, while 83 raised strips divided the main arc into 84 sections. Removed that secondary strip system and retained narrow flush joints in the lining map. Increased across-board texture resolution to 512 pixels, added periodic longitudinal wear and an RGBA roughness map, and moderated the estimated yellow oak tone. Board width, wear and material values remain photographic estimates, not calibrated samples. The previously inspected [axial reference photograph](https://images.dominikgehl.com/images/ireland/dublin/library-trinity-college/library-trinity-college-01.webp) is the visual reference. Main structural ribs and all vault sections remain modeled. Component screenshot inspection confirms removal of the superimposed heavy lines and continuous subtle board variation.

Validation: four full-model tests passed in 19.77 seconds; lint, typecheck and build passed. The component console returned no errors. Main route completed in 44,241.9 ms and reached idle; its entrance screenshot shows softer continuous wood variation without the prior secondary black strip system. No obvious glare or texture break was visible at that viewpoint. This isolated timing is not a controlled speedup measurement, and material calibration remains incomplete.

### Official existing-condition plan archive acquired

Dublin City Council application 2949/20 exposes 122 public attachments. Four existing floor-plan PDFs have been downloaded and validated; three sheets Y1.001–Y1.003 have been rendered and inspected. Y1.002 resolves the Henry Jones Room as 49 m² south of the west axial landing, with the grand stair north; Fagel is 55 m² at the east/south. See pavilion-plan-evidence.md and dcc-existing-plan-manifest.json for exact source URLs, hashes and limits. This supersedes earlier room-name/compass uncertainty for the existing 2019/2020 state. No proposed redevelopment geometry was imported, no runtime model change occurred, and no new build/test claim is made.

### Henry Jones Room and west-landing doorway integrated

Using Y1.002 for room identity, side and source area, added a south-side enclosure adjoining the adapted west stair. Net working floor rectangle is 6.6 × 7.41 m (48.906 m²); 5.8 m clear height, 1.04 m doorway and window sections remain estimates. The shared wall now has a door opening, top-landing wainscot is interrupted there, and a continuous threshold bridges the landing to the room floor. The former stair plaster panel was moved clear of the opening after visual inspection found an ornament protruding into it. Three south sash windows and one west sash have solid navigation barriers, frame depth and sills. Neutral local light remains an approximation. Memorials and furnishings were not invented.

The main route now offers Henry Jones 室 with guided forward/back travel through the west landing, plus return to Long Room. Five targeted model/connection tests passed (10.43 seconds), verifying both directions have floor support and collision clearance; an additional doorway ray check at three body heights passed (4.58 seconds). Component view was inspected; final main-route verification follows.

Final verification: lint, typecheck and build passed. The live main route loaded in 57,695.9 ms with 535 colliders. Entered Henry Jones route, advanced through 0, 4, 8 and 11.36 m, then reversed through the doorway to 3.37 m; sampled collision states stayed clear. Return to Long Room cleared the route and restored eye (0,1.65,-43.5), also clear. The door component and main room screenshot were inspected. Console sample contained only the existing Drawer width deprecation warning. This verifies local access to the new shell, not completed room furnishing, calibrated lighting or exact surveyed dimensions.

### 2019 surveyed internal elevations — high-window correction

DCC application 2949/20, document `4EF2FBE2C67911EA80E2005056B85853`, is a 33-page Murphy Surveys drawing set. Page 1, Cross Section 6A, and pages 15–16, Ground Internal Elevations 1–4, were inspected at readable resolution; a contact sheet was used only to locate the other pages. The survey is dated December 2019 and received by DCC on 30 June 2020.

Page 15, G_E-1, shows two tall sash windows with three columns and five rows of panes, alongside plaster panels. The current provisional single high-window model now uses this 3 × 5 grid instead of 2 × 3. Its single opening, position, dimensions, wall orientation and lighting are still estimated; this small correction does not establish a surveyed west enclosure. Pages 15–16 also provide distinct wall compositions, rather than four repeated panel arrangements. These require coordinated enclosure reconstruction before claiming fidelity.

Y1.004 (attic and roof) and Y2.001 (existing elevations and central section) were also visually reviewed. Level labels have not yet been transcribed at sufficient resolution and are not used to change runtime heights. Download hashes and reviewed pages are recorded in `dcc-existing-plan-manifest.json`.

#### Follow-up: paired-window wall
The G_E-1 composition now replaces the invented single rear-wall window: two 3 × 5 sashes on the first-flight side wall, narrow panels between and after them, and a lower door beneath the left sash. The rear-wall lower door is shifted toward the second-flight landing, following G_E-2 topology. Mapping the elevations to the existing three-flight model uses stair slope and door adjacency; it is not a compass survey. Local window centers −2.55 and +0.85, widths 1.55, base 4.5 and height 3.25 remain adapted dimensions. The smaller lower window, exact plaster relief, door ornament and calibrated wall/stair heights remain unfinished. The former high-window light was moved to the window side; illumination remains an approximation.

#### Follow-up: lower sash and rusticated opening
G_E-1 page 15 also shows a lower four-column/two-row window aligned beneath the right high sash. This is now modeled with separate glazing collision and a real aperture in both the structural wall and applied plaster courses. Wall finish rectangles are split at every opening boundary, including partial-height courses. The 1.55 × 1.05 m opening at local base 2.65 m and the 4.1 m frieze center are adapted placements, not measured dimensions. All four walls share that frieze level; ten rustication courses meet the lower band. Browser inspection confirms the pane grid remains visible above the raking lining. Exact surveyed floor/ceiling calibration and door ornament remain outstanding.

### Y2.001 level calibration

A high-resolution rendering of the existing central section's western level legend confirms −800 mm west-pavilion GF, +4580 mm first FFL, +10070 mm second FFL, +13470 mm third FFL, +17000 mm attic FFL and +21750 mm roof level. The source rise from western GF to first floor is therefore 5.38 m, close to the existing 5.4 m stair adaptation. The source second FFL is 10.87 m above western GF. These readings supersede earlier unverified guesses of +10700 or +13400.

The former 8.5 m enclosure top left only 3.1 m above the upper landing. The runtime ceiling now stands at local 10.45 m, with a **provisional 0.44 m build-up** below the 10.89 m adapted second-floor reference. This is not a surveyed soffit thickness. Henry Jones Room now shares this ceiling and has 5.05 m clear height. The extra overlapping upper shared-wall filler was removed. Cornice, relief, wall cores, light target and upper panel positions were moved together; the stairs and supported circulation remain unchanged. High sash base is now 6.3 m; lower sash base 3.25 m; frieze center 5.15 m. Those offsets remain reconstruction estimates pending detailed dimensional calibration.

### East pavilion: Fagel room replaces scaled placeholder
Y1.002's first-floor east-pavilion detail identifies Fagel at 55 m² south of the axial circulation, two transverse fittings with central openings, three south facade windows and two east facade windows. A crop of the source plan was inspected before implementation. The 2019 survey bundle's pages 32–33 (Level 1 internal elevations 9–12) were also visually reviewed for screened fittings and sash grids; precise dimensions were not extracted.

The old one-sided vestibule shelf and shallow ceiling were removed. `longRoomFagel.ts` supplies a separate unscaled room, 7.33 × 8 m between wall centerlines (approximately 55 m² net), two screened shelf rows, five room windows, circulation end window, floor and ceiling. Its central gaps have supported collision-clear floor, and case footprints prevent passage through the books. One thousand anonymous historical volumes use one instanced mesh, without pretending to be catalog books. Case proportions, finishes, floor build-up, window dimensions and wire spacing remain reconstruction estimates. Main-hall navigation into the eastern pavilion has **not** yet been opened; northern stairs and a complete guided east route remain work to do.

#### Fagel guided route
The east portal now has separate wall-pier/head and open-door-leaf colliders. The former solid collider across its opening was removed. A 14.4 m guided path starts at (0,0,43.5), turns at (0,0,49.5), and finishes at (8.4,0,49.5); both bookcase gaps stay on the route. The route uses the existing forward/back controls and a Fagel toggle with a return-to-hall action. Guided room movement is capped to 0.12 m per frame. Five model tests passed in the final isolated run, including complete forward/reverse collision and floor support. Earlier runs timed out; the floor rays were restricted to actual support meshes instead of scanning all books. Browser entry was verified at 0, 8 and 14.4 m with clear collision. Return verification was interrupted by build hot reload and remains pending. The destination controls use two columns to avoid squeezed labels.

#### Fagel entry and return verified
The main-hall Fagel entry is now connected. Browser checkpoints at route distances 0, 8 and 14.4 m were clear. After the build reload, an 8 m excursion was reversed to 0 m and the Return to Long Room button cleared the route at (0,1.65,43.5). The final two-column destination controls were visually inspected with no horizontal document overflow. Five focused model tests, lint, typecheck and the final build passed. Earlier blocked-entry/pending-return notes are superseded by this verification; northern east-pavilion stairs and detailed room fidelity are still incomplete.

### East stair survey and component study
The additional DCC document `1B69332CC67911EA80E2005056B85853` is a 30-page survey bundle. Pages 25–26, XS-3A and XS-3B, explicitly cut the east pavilion and show the solid-parapet stair between exhibition GF and Long Room circulation. This is distinct from XS-9A/9B in the earlier bundle, which are west-pavilion sections. Ground/first/second plans also distinguish the large return stair from the smaller adjacent service stair.

The new `longRoomEastStair.ts` component uses the source 4.58 m floor difference and estimated two 14-riser flights, 3.9 m runs, 1.3 m width, 1.8 m return centerline radius, 0.12 m solid parapets and 1.05 m guard height. The turning landing is genuinely curved, not rectangular. Radius, exact stair count, level turning assumption, rail details and surface finish still require calibration; they are not measured claims. Both travel directions have supported treads/landing and clear central collision, and parapets block lateral escape in the focused test. This is an independent review component, not yet a navigable live-pavilion addition.

### East stair integration
The east stair component is now attached to the live pavilion root via `longRoomEastEnclosure.ts`. The first-floor circulation north wall is split around a 1.7 × 2.35 m upper opening at local z7.4, meeting the existing upper arrival slab. North/east window walls enclose both levels, and the ground arrival has a slab at −4.58 m and a lower opening at z3.8. These are adapted offsets and window sizes, not surveyed dimensions. The adjoining lower exhibition remains an unfinished enclosed shell, and the separate service core is absent.

The expanded stair test builds the actual Fagel/enclosure hierarchy and samples both travel directions through the upper threshold, two flights, curved landing and lower threshold. Floor support and collision checks passed. The integrated `component=east-enclosure` entrance view was visually inspected. The main user interface does not yet expose an east descent route; live geometric integration is not a completed navigation claim.

### East descent navigation
The main UI now exposes 前往东楼梯. `longRoomEastWalk.ts` supplies the same distance-parametrized route tested through the actual east portal/enclosure: start (0,0,43.5), turn into the upper landing at z52.4, descend the two flights through the curved return, and finish at (−1.2,−4.58,48.8). Forward/back and return-to-hall share the existing walking controls. The curved path uses 64 chords matching the landing tessellation. The actual route was sampled forward/reverse for support and collision in the focused test. This replaces the earlier missing-route implementation note; browser verification is recorded separately. Exhibition reconstruction and the separate service stair remain unfinished.

### East descent browser verification status
The main route reached its 27.40 m lower endpoint at eye (−1.202,−2.930,48.800), with collision clear. Reverse travel passed the curved landing and reached the upper level at distance 8.96 m, eye (−0.061,1.650,52.400), also clear. Repeated browser-control timeouts prevented confirmation of distance zero and the final exit; neither is claimed as passed. The two focused route/support/collision tests, lint, typecheck and build passed earlier in this verification sequence. The lower arrival remains an unfurnished shell. An uncontrolled live load reported worldBuildMs 252435; performance is still unfinished. This supersedes the earlier missing-route implementation note, not the remaining fidelity gaps.

### East service-core evidence and pavilion sash refinement
Visually reviewed the complete XS-4A and XS-4B sheets (pages 27 and 28 of `old-library-survey-report.pdf`, Murphy Surveys, 20 December 2019, DCC received 30 June 2020). They show a narrow multi-level stair beside the large pavilion rooms, with closely spaced landings and vertical guards; it is distinct from the ground-to-first solid-parapet return stair on XS-3A/3B. The service core is still absent from the model. These sections establish topology, not extracted metric dimensions or an approved live placement.

Pavilion windows now have two depth-offset sash leaves and profiled, bevelled rails and glazing bars. The former hard-coded meeting rail at row two is replaced by the leaf split: two/three rows for the western five-row window and three/three for the eastern six-row window. Window openings and glass collision are retained. Profile widths and depth offsets remain reconstruction estimates; this is not measured joinery. The dedicated `component=pavilion-sash` oblique browser view was visually inspected. Existing window-opening/glazing-collision and both east stair support/collision tests pass (2 files, 3 tests). Full-hall visual completion and service-core reconstruction are still pending.

### East service stair study
The Y1.002/003 plan places the small winding stair beside the lift in the northwestern part of the east pavilion; the large solid-parapet return is east of it. XS-4A/B shows the independent stair continuing across the upper storeys. A dedicated `longRoomEastServiceStair.ts` component now reconstructs this distinct topology with relative floor levels −4.58, 0, 5.49, 8.89 and 12.42 m from Y2.001. Width 0.86 m, centerline radius 0.7 m, straight run 2.7 m, eight winders per rise, riser count and profile sizes remain estimates. Do not describe them as surveyed measurements.

The component has closed risers, curved winding treads, continuous side stringers, round handrails and instanced vertical metal balusters. Curved guard collision is subdivided using each side's own radius; an initial over-broad inner-turn collider was found and corrected. The focused test verifies walking samples in both directions, support, standing headroom and lateral guard blocking. The `component=east-service-stair` browser overview was visually checked after the correction. This is a review component, not a connected live stair: the pavilion upper rooms, floor openings, service enclosure and lift remain unfinished.

### User-requested stair and basement correction
Removed the freestanding long timber access stair and its landing; reinstated the upper gallery rail and posts at its former connection. The guided gallery route now follows the photo-derived iron alcove spiral, through its top landing and along the gallery. Replaced its blocking whole-cylinder collider with a center-post collider and segmented outer guards. Entry/exit guard sectors are open for passage; profile, dimensions and these access adaptations remain estimates. The upper end crosswalk still remains an adaptation.

The user then requested removal of the basement. Removed the central descending visitor stair, its lower platform, light and blocking volume. A continuous, consistently mapped timber floor closes the central opening. This is an explicit user-directed departure from the visitor-guide source, not a claim that the source has no descending stair. Ground-level east/west pavilion circulation is distinct from this removed central basement entrance.

Final browser ascent reached route distance 12.00 m, floor 2, eye Y7.600 and collision clear; reverse returned to distance 0.00 m, floor 1, eye Y1.650 and clear. Exit left walking mode. The 2 focused model files / 5 tests pass, covering route collision after batching, physical floor support and absence of the removed stairs. A 60000 ms test timeout was used for the loaded host; this is not a performance pass. Overall 1:1 fidelity remains unfinished.

### Main-hall window resource reuse
Full window details are now constructed once per side within each scene build, then cloned into the twenty bay positions. Existing shared sashes and reveals are retained; round architrave beads, blind folds, rollers, sill/head joinery and catches now also share geometry. No cross-build cache is used, so disposed geometry/material sets cannot leak into later scenes.

The before/after probe of 1,480 named detail meshes recorded 1,480 distinct geometries before and 74 after. Per-mesh names, six-decimal world bounding boxes, vertex counts and index counts matched exactly. See `window-detail-reuse-verification.json`. Single build samples were approximately 4.34 s and 3.10 s under uncontrolled host load; these are not a controlled TTI benchmark or a general performance claim. The temporary comparison test passed and was removed after recording its result; the permanent Long Room test verifies twenty correctly positioned windows on each side and shared geometry/material identities. All four Long Room tests pass. The main overview was visually inspected after reload; central floor remains continuous. Architectural completion and overall loading performance remain unfinished.

### Spiral top-aperture guard correction
The visible perimeter around the iron spiral's gallery opening lacked collision. Five collider segments now follow those guard lines, preserving the central outlet. Outlet and landing width are aligned at 0.9 m so adding guard collision does not close the passage for the existing 0.3 m camera clearance. The opening uprights now use a shared round cylinder section and a lower rail. These dimensions and details remain adapted estimates.

The Long Room test now explicitly checks blocked crossings at all five perimeter segments and a clear crossing through the outlet; the full forward/reverse guided route and physical support checks also pass (4 tests). Browser and final build status follow separately. Overall fidelity is not complete.

### East upper pavilion room
Added `longRoomEastUpperRoom.ts` to the live east pavilion hierarchy above Fagel. Y1.003 labels this room Early Printed Books, 112 m², FFL +10070. Relative to first floor +4580 the modeled floor is +5.49 m. The adapted envelope x−9.33..9.33, z0.5..8.5 and estimated ceiling +8.54 are not surveyed interior dimensions; slab area excluding the reserved core is approximately 133.638 m², not the source's 112 m². The difference remains part of the requested enlarged experience.

The room has a continuous mapped timber floor around a real service-core opening, a ceiling, a west doorway/threshold and separate window apertures with glazing collision. The reserved stair/lift footprint is temporarily enclosed by full-height walls until the core is connected. Window sizes, pane counts, joinery and lighting remain estimates. The room is unfurnished and has no live guided entry yet. The upper-room/Fagel/east-stair tests pass (3 files, 4 tests), covering floor support, guarded core, open internal doorway, glazing collision and preservation of lower circulation. The upper-room browser view was visually inspected. This is progress on the missing volume, not a completed pavilion or 1:1 claim.


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

The same public account explicitly describes two Henry Jones plaques and transcribes the modern lower panel; a separate Trinity College Library history places Jones's brass memorial above the door to the original building. The runtime Henry Jones Room now carries a paired display above its adapted west doorway: a smaller upper brass identification panel and a larger lower panel with a short public transcription excerpt. The older plaque's full Latin and heraldic details remain unclaimed, and the wall coordinates are adapted to the enlarged connection.

Added `createHenryJonesMemorialDisplay` and a focused `henry-memorial-room` review route. Plaque geometry is thin, non-colliding wall detail; the Henry Jones walking route still clears the doorway. Close browser view confirms readable lettering, separate timber surrounds, brass finish and corner fasteners. The text canvas is intentionally browser-only; jsdom structural tests verify placement and route clearance without requiring a Canvas 2D implementation.

Validation: two Henry/connection tests passed. Sources: https://www.patrickcomerford.com/2012/10/memories-of-old-bishop-and-old-book-in.html and https://api.pageplace.de/preview/DT0400.9781139950114_A23869416/preview-9781139950114_A23869416.pdf. This is a sourced detail addition, not completion of the full measured reconstruction.

The dedicated plaque review now includes the shared north wall, doorway head and timber jambs used by the live west connection. The door opening remains clear at standing eye height while the wall closes the space above it; this removes the previously floating black review background without duplicating the live connection's wall/collider.


### Full frontend validation after Henry plaque — 2026-09-10

The final frontend regression run completed with `pnpm --filter @bookkin/web test`: 91 test files passed and 275 tests passed. The run includes the Henry plaque/connection suite and the west-stair and password-policy assertions corrected to match the current shifted doorway and normal-password form state. `pnpm --filter @bookkin/web lint`, `pnpm --filter @bookkin/web typecheck` and `pnpm --filter @bookkin/web build` also exited successfully.

Vitest still prints the repository's jsdom CSS, pseudo-element and Canvas 2D capability warnings; they did not produce failing tests or browser runtime errors. The existing Ant Design Drawer `width` deprecation remains in the live browser log. This validates the current frontend snapshot, not measured 1:1 architecture, mobile behavior or a controlled GPU/FPS benchmark.


### Current runtime performance and real-category recheck

A fresh authenticated desktop page with four real catalog books measured worldBuildMs 501.2, worldFinalizeMs 16.8, shaderCompileMs 73.3 and longestBuildSliceMs 25.5 (construction-0). At the settled entrance it reported 188 draw calls, 6,547,238 triangles and idle rendering. These are current local snapshots with uncontrolled cache/host load, not a controlled improvement relative to older multi-second runs. Last render CPU submission time (4.5 ms) is not GPU frame time or FPS.

The component profiler had an obsolete static-batching prefix, falsely omitting the new static-* phase timings. It now includes all static-* callbacks and labels the measured scope explicitly. A fresh corrected run measured 481.1 ms construction/batching, 469 static steps totaling 31.5 ms, maximum static step 2.8 ms and no individual recorded step above 50 ms. Per-step timings do not replace a browser long-task trace. No model geometry or renderer was changed based on these healthy desktop timings.

Clicked the real Literature category in the authenticated page: four books focused, camera collision clear, complete shelf-frame NDC corners within the viewport, then rendering settled to idle. No full reading flow, cold start, mobile, large catalog or sustained GPU/FPS benchmark is claimed. Exact values/limits are in current-performance.json. Browser directly verified the small review-only reporting fix; no mirrored unit test was added.


### West upper storage rooms and walkable end connection — 2026-09-10

Rechecked the official existing-condition sheet `dcc-2949-20/existing-03.pdf`, Y1.003. The west end of the second-floor plan labels a 21 m² storage room, a 78 m² storage room and a 4 m² circulation area beside the northern stair core. The sheet's +10070 datum is retained as +5.49 m relative to the Long Room first-floor +4580 datum. The active hall remains the enlarged adaptation, so the modeled 18.66 × 8 m envelope does not claim the source net areas.

Added `longRoomWestUpperRooms.ts` to the live west connection. It now contains the two transverse partitions, the short longitudinal subdivision, real north/south/west window apertures, mapped floor and ceiling, timber door linings, and two low perimeter storage benches corresponding to the sparse blocks shown in the plan. The three-step entrance transition bridges the enlarged gallery +5.95 m and room +5.49 m datums; 1.8 m width, 0.35 m going and 0.46 m total rise are explicit adaptations rather than surveyed stair dimensions. The front crosswalk guard is split around the upper doorway while the rear guard remains continuous.

The west upper portal is now an open connection in the live study path. `WEST_UPPER_WALK` crosses the spiral and gallery, enters the end portal and samples the storage cells through their door openings; the new `西端储藏室` control exposes this route with the existing forward/back movement. The northern stair/core remains reserved rather than invented, and the rooms are not presented as a complete historic fit-out.

Validation: west upper room, west route and full Long Room suites passed (3 files, 7 tests); `pnpm lint`, `pnpm typecheck` and `pnpm build` passed. Browser `/virtual-library` reached the west room on `west-upper` at eye y=7.14 m with collision `clear`; the only logged item was the existing Ant Design Drawer `width` deprecation warning. The source plan and adapted dimensions are recorded in `public-reference-data.json`.


### Historical benefactor frieze lettering — 2026-09-10

The official Trinity Long Room page lists five names commemorated by the gold band below the gallery: James Ussher, King Charles II, William Palliser, Claudius Gilbert and Theophilius Butler. Replaced the former two modern donor panels with bilateral, source-named frieze panels. Text is rendered as gold lettering on dark green backing with timber rails; font size, panel spacing and bay assignment are adapted to the enlarged hall, not measured joinery.

The refreshed main-hall browser view shows the lettering beneath the gallery while preserving the clear central floor. The source names and the adaptation boundary are recorded in `public-reference-data.json`; the pre-2023/current conservation-state distinction remains unchanged.

### Benefactor plaques removed from the live hall — 2026-09-15

The user explicitly removed the full set of adapted historical benefactor-name plaques from the live Long Room. Their published names remain in the evidence record, but no green backing panels, gold lettering or donor-frieze geometry is now constructed in the runtime hall.
