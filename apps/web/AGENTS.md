# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

The library book grid is intentionally static: do not add hover zoom, lift, transform, or stronger-shadow effects to book cards or covers. Preserve visible keyboard focus and working card actions.

The public homepage header must not show a display-book count badge.

Use PageContainer and PageHeader for standard page introductions. Keep the eyebrow, heading, description, and top spacing consistent; do not recreate their typography or override page-top padding on individual listing or management pages.

Keep the navigation drawer and its content at one shared width. Put BookKin in the drawer header beside the close control, and inset navigation items evenly instead of adding a second brand section inside the body.

Use a compact Ant Design dropdown for the global theme selector, aligned to the trigger's right edge; close it automatically when the pointer leaves the trigger and menu region.

Keep the global navigation and page content on the shared page-width rule, with identical maximum width and responsive horizontal gutters. Align the outer navigation controls with the content edges.

The header search must expand on mouse enter and also support clicking on touch devices, focus its input, and collapse on mouse leave, blur or Escape while preserving the query. Keep its expanded field within the viewport on phones. The theme dropdown must also open on mouse enter.

The library book-action menu uses one `编辑元信息` entry for cover, title, and other bibliographic fields; do not split `更换封面` or title editing back into separate menu items. Keep NAS location changes such as `移动` as independent file operations so they continue through fingerprint validation and the safety-preview flow.

The library homepage includes a compact recent-annotations module beneath the latest-book card, in the same content flow rather than as a separate column. Show only the signed-in user's newest private annotation, link back to the exact EPUB CFI or PDF page when available, and keep a clear empty state without adding goals or streaks.

The library homepage overview uses a two-by-two desktop composition: all four overview cards share the same height, the two cards in the left column share one width, and the two cards in the right column share another width. On narrow screens, keep the cards stacked in one column.

Keep overview cards compact at the token-derived 336px height rather than 480px. Use skeleton placeholders for library overview, statistics, annotations, and catalog loading; do not flash zero-data empty states before requests finish.

The featured-book cover in the overview must visibly clip all four image corners using the shared radius token. Keep the image box fitted to its natural aspect ratio within the cover slot; do not apply rounding to a larger letterboxed image box whose corners never touch the visible cover.

The four library-homepage overview cards share one visual hierarchy. Keep every section label at the same top-left inset with the same display font, weight, line height, and same-size leading icon; use contrast-aware color only where a dark card requires it. Treat the featured book title, weekly duration, newest annotation content or empty state, and current-reading title or empty state as one secondary tier with matching typography and vertical rhythm. Do not enlarge or detach one card's section icon, vertically center a section label, or omit the featured-card icon.

Keep overview-card actions sparse: the featured card has only `开始阅读`, the recent-annotation empty state has no reading CTA, and the reading-progress empty state has no book picker; show `继续阅读` only after a real position exists. Render both lower-row zero-data states through the shared `OverviewEmptyState` so their title variant, description variant, line height, spacing, card-content inset, and vertical rhythm remain identical; do not reserve an invisible section-icon column inside the reading-progress content. Express weekly comparison as a percentage increase, decrease, or zero change, and leave the area beneath the weekly chart empty instead of adding an accumulation hint.

At tablet widths, the library action and filter controls may share horizontal rows with wrapping; on phone widths, keep them stacked and full width.

On the reader-font management page, start each font card directly with the font name and metadata; do not add a leading font-icon tile. Show only the status switch at the right edge, without visible `启用` or `已停用` copy beside it, and preserve an action-specific accessible name on the switch itself.

End the reader-font management page at the font list. Do not add a trailing divider or explanatory paragraph about disabling fonts and fallback behavior.

In the font-upload form, align the name input and font-kind select using equal label gaps. On desktop, align the file-selection button with the license input; place file-format guidance below the control row so it cannot lift the button out of alignment.

On desktop authentication screens, the default `mountains-autumn.jpg` artwork fills the entire left panel with the library introduction centered over the image in the same middle visual band as the form, while the authentication form occupies the right panel. Place the `BookKin` brand independently at the image panel's true upper-left safe edge; do not inherit the centered introduction's much deeper horizontal inset. Keep a mobile-only brand above the form when the artwork is hidden. The login title has one concise, playful greeting selected from morning, midday, and evening according to the visitor's local time. Show the owner-initialization link only when the public setup-status check explicitly reports an uninitialized library; hide it while unknown, on failure, and after initialization, and redirect direct `/setup` visits once initialization is complete. Do not pin the introduction to the image bottom or restore the teal field with a floating cover card; small screens may hide the artwork and prioritize the form.

Keep anonymous access limited to the explicit public discovery surface: `/library`, `/categories`, `/booklists`, and public-book reading. Every private library, annotation, display-setting, recycle-bin, virtual-library, password, and administration route must pass through `RequireAuth`. A signed-out direct visit must render the dedicated 401 access page without mounting protected content; an authenticated role mismatch must render the 403 variant instead of silently redirecting. Preserve the attempted path, query, and hash when sending a signed-out visitor to login.

The PDF reading-mode viewport must clip offscreen virtual columns at the inner page boundary. Use a single page below the tablet breakpoint and a two-page spread from the tablet breakpoint upward; at single-page, spread, and phone widths, no fragment of an adjacent virtual page may remain visible. Verify virtual-page navigation and zero horizontal overflow in the browser.

Place the PDF previous/status/next navigation directly below the current reading page or spread, in normal document flow. Treat that bottom navigation as the reader-generated page label; do not add a second standalone `第 N 页` footer inside reflowed PDF text. Preserve page numbers that are part of the source PDF itself and keep scanned-page accessibility/status copy distinct from pagination.

Reader annotation actions are incomplete until the saved style appears immediately inside the visible article without a reload. Verify highlight, underline, and bold live in EPUB and paginated PDF locators, including PDF locators with a virtual-page `&offset=` suffix.

The reader's Paper, Bright, and Night themes are whole-site themes. The global shell and reader settings must share one persisted choice, and every route, dialog, menu, form, card, and management surface must use semantic theme colors instead of assuming a light background.

The reader settings menu includes a persisted `翻页效果` switch that is enabled by default. Turning it off must make PDF, EPUB, and demo navigation change pages immediately without the WebGL curl or fallback animation.

The standalone virtual 3D library follows the selected moonlit circular-rotunda direction. Treat visible low-poly placeholder geometry as unacceptable: shelves, books, architecture, stairs, materials, and lighting need enough modeled and textured detail to read as an immersive old-library interior while retaining click-to-select book details and free scene orbiting.

The circular-tower model supplied on 2026-08-24 is the current `/virtual-library` architecture baseline: retain its double-height book walls, upper gallery, spiral stair, Gothic windows, enclosed painted roof, and moonlit exterior when refining the scene. Integrate it behind the product's existing catalog and interaction layer rather than importing its standalone demo UI or decorative filler books.

The central floor must not contain freestanding reading tables or inner-ring bookcases. Its only fixed furniture is a horseshoe reception desk whose geometric center sits at the center of the innermost floor ring, aligned with the entrance and opposite focal wall; do not place a librarian or other humanoid figure in the scene. Keep decorative return stacks visibly supported by that continuous physical tabletop, never floating in the open ring or using a detached plinth; catalog books are not moved to the desk.

The main double-door entrance, reception desk, and opposite focal wall share one axis. The wall directly opposite the entrance must remain free of bookcases and instead contain a modeled fireplace plus a locally packaged public-domain masterwork with source notice.

Interpret the user's left and right sides of the virtual library from the entrance looking across the central floor ring: the restricted archive occupies the ring's left-hand wall and the director's office occupies the mirrored right-hand wall. Keep both as original, matched pointed-arch door compositions; do not reproduce protected film-set architecture, crests, branding, or other franchise-specific assets.

The director-office hall portal must read as one coherent architectural doorway: use two equal tall rectangular walnut leaves up to 72% of the pointed opening, a centered seam with paired handles, mirrored outer hinges, and a fixed pointed stained-glass transom that shares the office moonlit-library motif. Show the timber door and internal transom rail without any separate stone, brass, or gold pointed-arch frame around them; brass remains limited to restrained hardware. Do not return to a short door beneath a blank timber tympanum or one oversized pointed slab carrying a mixed panel grid.

The restricted-archive hall portal is a closed original Gothic double-leaf iron gate: use seven symmetric vertical members including the center meeting stile, three horizontal rails and three hinge sets per leaf, restrained lancet finials, one centered slide bolt and one mechanical lock. Keep a deep dark pointed recess behind the bars, retain the outer stone arch, and omit the former solid timber leaves, decorative rivets, paired pulls, inner gold arch, keypad-like blocks, face-like rings, and intense red hardware wash.

The main hall's interactive catalog layer must render exactly one 3D book model for each real catalog book and must not fill empty shelf space by repeating titles. Keep each unselected model naturally inserted between shelf boards, and pack real books assigned to the same shelf row into one centered contiguous run instead of leaving an arbitrary central gap. Shelf focus moves only the camera and persistent frame. Clicking a real book must pull that original model forward within the current focused-bookcase view for cover inspection, drag rotation, and wheel scaling; a short press and release on that same inspected model opens `/reader/:bookId`, while a drag continues to rotate it. Clicking another visible shelf book must switch inspection directly without a reset. Never move a book to the reception desk or spawn a duplicate floating model, and always restore its exact shelf transform when inspection closes. Non-interactive office background volumes are governed separately below and must never reuse catalog titles or cover textures.

When refining the virtual library, build depth with layered inset wood panels, shelf supports and labels, fluted and collared masonry, modeled reception and fireplace props, localized shelf-wash lighting, and restrained bloom. Do not compensate for sparse catalog data in the main hall with decorative filler books, oversized glow, or flat dark shelf planes.

Shelves, balcony railings, columns, dome glass, and iron ribs must share one coherent center/radius system so every structural element is visibly embedded. Keep the complete balcony railing below the Gothic-window sill so rails, balusters, braces, and ornaments never cross the window openings. Preserve free drag orbiting, but do not show front/left/right preset buttons in the idle hall. Keep every visible interactive hall book tied one-to-one to catalog data; the non-interactive office background volumes defined below remain outside that catalog layer.

Distribute the main hall columns as symmetric pairs flanking the four primary architectural features: the entrance, the opposite fireplace and painting, the restricted archive portal, and the director office portal. Do not place them with a generic every-other-sector rhythm that leaves focal features visually unbalanced.

On the virtual-library scene, the mouse wheel zooms the entire rotunda while no book is being inspected; during real-book inspection it scales only that pulled-forward book, direct dragging rotates it, and a click shorter than the eight-pixel movement threshold opens the reader. Keep only the clickable book title beneath the inspected cover, without extra instructions or metadata. Keep the idle hall free of the top-right title and catalog-count copy. Its compact right-side control contains only the restricted archive and director office switches, without a 360-degree label or directional presets. A catalog-query failure must offer an in-place retry rather than only telling the user to leave the scene.

Every visible shelf face must expose a hover outline and a persistent selected frame. Clicking a shelf turns the camera squarely toward that face before books can be chosen. Real catalog books are grouped by deterministic first-level categories, with three named second-level shelf bands and modeled plaques that remain legible when focused.

Focused hall bookcases keep only the centered first-level and second-level category plaques on their shelf fronts. Do not add repeated left, center, and right brass accent blocks or other per-shelf ornament rows that can be mistaken for extra plaques.

Do not show a separate category summary card when a hall bookcase is focused; the modeled first-level and second-level plaques are the category copy. During book inspection, show only the selected title immediately beneath the pulled-forward cover—never repeat author, format, category, instructional copy, or a close button in a large text panel. Keep the other books in the focused shelf row visible and selectable so clicking another book switches inspection directly without requiring a close/reset step. Keep room summaries available. Escape first restores an inspected book and preserves shelf focus; a second Escape or clicking the same shelf leaves shelf focus.

Treat every centered hall classification plaque as a physical, fully opaque backed plate mounted wholly outside the shelf-front fascia. Keep at least 0.012 model units between the fascia surface and the plate's rear face, place the texture face beyond the solid backing with normal depth testing and depth writing, and never use transparency or render order to hide an intersection. Verify the primary plaque and all three secondary plaques from the front, both oblique sides, and zoom limits so no shelf board can show through or flicker.

The restricted archive and director office doors are functional portals into separate, fully modeled original Gothic rooms with a clear return-to-hall action. Preserve the dark-academia atmosphere through original architecture, furniture, lighting, and public-domain assets; never copy protected film-set layouts, franchise crests, names, props, or branding. Do not render a floating bottom mouse-instruction pill in the hall or either room.

Entering `/virtual-library` must not make the user wait for avoidable hidden work. Preload the lazy 3D route and private catalog from authenticated navigation, schedule heavy WebGL setup after the route can paint, and create the restricted archive and director office only when a room is first opened. Preserve this staged-loading contract when adding room detail or assets.

Inside the restricted archive, keep the central lectern and side barred archive cabinets, but use an original sealed double-door vault as the rear focal feature: layered timber panels, iron reinforcement bands, rivets, crossed chains, and a central lock. Do not restore the pointed inner iron gate or a redundant rear-wall room plaque.

The director office uses exactly one artwork distinct from the hall's fireplace masterwork. Center it directly behind the director's chair, and keep wall trim, arches, the chandelier, chair, and desk from cutting through the visible focal area. Orient the desk so its drawer fronts face the director's chair and rear wall while visitors see the modesty panel; never reverse those working and visitor sides. Use open, modeled bookcases rather than flat archival drawer banks along both side walls, and fill every visible shelf on both walls with dense non-interactive archival volumes. These office background books must not reuse real catalog covers or titles, register as selectable books, or alter the main hall's one-to-one catalog model count. Keep the rear wall free of a redundant modeled “馆长办公室” plaque. Its terrestrial globe must use a detailed Earth texture, legible latitude and longitude guides, a tilted axis, and a modeled meridian ring and pedestal rather than a plain colored sphere.

The director-office moon window must occupy its own complete wall bay between bookcases and face its modeled frame and glazing into the room. Use one stone pointed frame, one depth-writing stained-glass pane, and one physical lead-came system around an original moon-stars-open-book motif; do not layer the shared rose window, a separate white moon disk, or duplicate bars over it. Do not let its frame, glass, or moonlight intersect shelf uprights or boards; use a soft inward light wash rather than a point-light hotspot that makes a bookcase appear to glow from within.

Treat the main hall, restricted archive, and director office as solid camera spaces. Their walls, shelves, columns, doors, stairs, gallery, reception desk, large furniture, and chandeliers must use model-anchored collision shells; orbit, zoom, shelf focus, reduced-motion jumps, and room re-entry must never pass through them. On contact, preserve continuous control by sliding along the surface instead of stopping or bouncing.

The main-hall spiral stair must meet the upper circular gallery through a full landing whose top is flush with both the final tread and gallery floor. The final tread's forward tangent must point into the gallery, and the landing must stay centered on the tread span rather than the stair spindle. Size the balustrade opening to that landing, finish both opening edges with terminal posts, and connect the stair handrails into those posts; do not leave a broad rail gap, dangling handrail, floating tread, or overlapping threshold at the junction.

Keep file-writeback preview tokens, source and target paths, fingerprints, lease or expiry details, and implementation-level warnings out of the reader-facing metadata confirmation. Preserve the internal preview and `expectedFingerprint` safety contract, show actionable conflicts when present, and require an explicit user confirmation before executing the writeback.

Ordinary metadata edits must update the visible book and metadata caches and close the editor synchronously; persist the change in the background, then reconcile with the server result. If persistence fails, restore both caches and show an actionable failure notice. Keep this immediate display-only path separate from the explicit original-file writeback preview and confirmation flow.

Keep `书库状态`, `用户管理`, `文件任务`, `阅读字体`, and `展示书目设置` exclusively in the signed-in account menu according to their existing role boundaries. Do not repeat them in the desktop primary navigation or mobile drawer, and preserve their protected routes. Order the authenticated reader-facing navigation as `首页`, `藏书库`, `分类`, `书单`, `阅读笔记`, `虚拟书库`.

Use a distinct semantic icon for every reader-facing navigation item. In particular, `首页` uses the home icon while `藏书库` retains the library-books icon; do not reuse the same glyph for both destinations.

Use Ant Design 6 as the only UI component library for new and migrated screens; keep shared adaptations in `src/ui/` and do not add a second component-library dependency. Use `src/charts/antv.ts` as the AntV G2 entry point for chart features, and feed charts from the same generated design tokens as the rest of the interface.

Use the native Ant Design DataTable for management tables. Keep column headings aligned with cell content, put account enable switches in their own column, and use compact text-link actions with consistent spacing.

Keep NAS root status cards compact: use modest vertical padding around the name/path and the capacity/scan row, and no extra vertical margin around the separating divider. Let content determine height so narrow-screen wrapping and degraded status remain readable.

The virtual library now targets a Hogwarts-inspired collegiate Gothic reading library: modeled moulded vault ribs, carved timber trusses, paired long reading tables, turned chairs, parchment stationery, and warm localized lamps against cool window light. This supersedes the earlier painted conical-roof visual target. Preserve original BookKin identity, real-catalog book correspondence, shelf inspection, room portals, lazy room creation, and model-anchored camera collisions.

Keep the virtual-library central floor clear: no added reading tables or chairs. Place one original celestial catalog orb on the existing central reception countertop; clicking it opens private-catalog search. Do not restore the computer, monitor or keyboard. Open a single search field at the center of the viewport, focus it automatically, and show results only after typing. Ceiling ribs must remain above the bookcase crowns; never run low transverse trusses or brackets into shelving. This supersedes the earlier paired-table and hammerbeam additions.

Every chandelier must have a continuous interlocking chain and ceiling mounting plate reaching the actual modeled ceiling, calculated from its room ceiling height and the fixture scale. Never leave a fixed-length suspension ending in mid-air after changing roof geometry.

Use separate icon and label slots in every shared button, including leading/trailing icons and router links. Never wrap the entire icon-plus-label composition in a Fragment passed to Ant Button, which flattens it into one text span and loses the gap. Keep a consistent token-based icon size and preserve keyboard and disabled behavior.

The fireplace fire must occupy the actual hearth volume behind the grate, with a grounded coal bed and upward turbulent motion. Do not use overlapping camera-facing flame sprites or a floating circular glow plate; orbiting must preserve the fire depth and its occlusion by the grate and masonry.

Access-denied page navigation must look like buttons: primary login/return action and outlined public-library action. Preserve router destinations and login return state; shared router-link buttons must retain the same visual variants as ordinary buttons.

The featured cover must scale with both available slot width and height, including tablet widths; use a generous cover column and a fitted 2:3 image box so rounded corners touch the artwork. Do not leave it constrained to its intrinsic size.

The setup form starts with all fields empty, disables automatic filling for nickname and username, and labels displayName as `昵称`. Do not prefill an owner username or autofocus a field that triggers saved-account filling.

Keep standard page content close to the navigation with compact shared top padding. Use the navigation search as the sole page search for booklists, category contents, library collections and annotation books; retain current route and filters, and never redirect unrelated pages into a global library search. Hide search where no page search is implemented.

Use Ant Design Form/Form.Item for setup validation with field-level errors and noValidate; do not use native browser validation bubbles. Preserve the minimum password length and confirmation checks.

Always render all four library overview modules, including an empty library or empty search result. Featured-book availability must never control the recent-annotations panel; show an explicit empty state instead.

The four library overview cards must have equal widths and equal heights: use two equal columns on tablet/desktop and retain shared row sizing. Do not restore an asymmetric featured/statistics split.

LAN HTTP is a supported deployment origin. Generate client UUIDs through utils/random-id.ts using crypto.getRandomValues; never call secure-context-only crypto.randomUUID directly. Test file queue selection with randomUUID unavailable.

Production acceptance must exercise LAN HTTP file selection and upload parsing, not only localhost, HTML and health. Preserve the application error boundary so render failures display a recovery action instead of blanking the screen. Clipboard actions must handle unsupported origins and rejected permissions.

Keep upload dialogs compact and viewport-bounded, with a scrolling content area and reachable fixed title/actions. Use the small dialog width for the queue and medium width for metadata review; do not force mobile uploads into full-screen dialogs.

Ant Design 6 Modal shell styles use the container semantic slot, not the obsolete content slot. Keep shell padding zero so title/content/actions supply exactly one layer of token-based padding.

Keep the library metadata editor compact: retain only the separator between cover controls and bibliographic fields, place the original-file writeback checkbox directly after the description, and never reintroduce an extra modal-body padding layer around the shared title/content/actions.

Upload selection or drop starts transfer automatically. Keep one primary upload action, show uploaded confirmation, and navigate to the persistent book-information editor on confirmation. Do not expose the inspection queue or batch commit in the upload dialog. Preserve server validation and staging; metadata editing completes safe ingestion.

Do not show a batch-rename action on the library collection page. Keep individual book metadata editing in the book action menu.

Shared menus and popovers must use their measured dimensions, flip above bottom-edge anchors, respect transform origins, and stay within the visual viewport during scrolling/resizing. Never position them with a guessed fixed menu width.

Consolidate the five account management entries into one Settings entry. Settings tabs use persistent URL hashes; preserve role checks, redirect former routes to their tab, and render existing functions without nested page padding or duplicate large headings.

User management is an independent account-menu entry at /admin/users. Keep only library roots, file tasks, reader fonts, and display books in Settings tabs; legacy #users redirects to the independent page. This supersedes the five-tab consolidation.

User management keeps the table from the sm breakpoint upward, including iPad portrait widths; reserve user cards for phones below sm. Keep horizontal overflow inside the table container.

Keep management pages focused on controls and data. Do not restore the static role-permissions information banner above the user table; reserve alerts for actionable current states.

Place Create User on its own left-aligned toolbar row immediately above the user table, separate from the page title and introduction.

Standard page headers consistently place eyebrow, title and description above a separate left-aligned action row at every breakpoint. Use shared PageHeader action layout instead of floating page actions alongside the introduction. Keep collection toolbars below their section heading.

Settings contains library roots, reader fonts and display books only. User management has anchored tabs for user list (#users), operation logs (#operations) and login logs (#logins). Redirect former file-task routes and the settings file-operations anchor to /admin/users#operations. Do not repeat page headings within these tabs.

The homepage is the public display catalog. Do not show a separate 展示书目 item in desktop or mobile primary navigation. Signed-in users enter management via the homepage action 管理首页书目, retaining the protected /display-books management route for adding, removing and reordering homepage books. Keep legacy display-setting redirects compatible.

All page-level action toolbars align to the right edge, including Create User, refresh, add and upload actions. Keep the separate toolbar row below the header or tabs; this supersedes earlier left-aligned toolbar guidance. Use shared ActionToolbar for dedicated action rows and PageHeader actions.

Moving a book between libraries shows its current library, a destination library selector, validation, and confirmation. Preserve its relative path automatically; keep fingerprints and staging details behind the server safety flow rather than asking users to enter paths.

Show operation feedback and error notices through the shared Ant Design bubble notification provider, outside page flow. Preserve retry actions and dismiss controls; success notices auto-dismiss. Keep a token-based gap below standalone settings save toolbars.

The AI provider selector chooses the single active provider on save. Do not show a separate per-provider enable switch. Restore the enabled provider on load; retain the global AI switch.

Keep AI platform settings in one left-aligned form column, with each field on its own row. All inputs and selects, including custom model IDs and API keys, share the provider selector's compact maximum width and shrink to fit narrower screens. Place the optional clear-key control below the API key input so it cannot reduce that input's width.

Ant Design uses the dark algorithm for Night mode. Select values remain fully legible while open; selected and active options use theme semantic colors.

The virtual library now has at least four vertical storage storeys with three circular galleries and a larger 38.4-unit interior diameter. Preserve this expanded rotunda scale when refining the architecture; this supersedes the original double-height baseline.

The BookKin wordmark over the authentication artwork uses the shared white color, matching the white artwork copy.

Global feedback bubbles use the shared bodySm typography token for notification titles and descriptions, keeping notices compact.

Visiting /login or /login/ with an existing valid session enters the homepage; temporary-password sessions enter /change-password. Show visible session-loading and retry states, and only show the login form once the visitor is known to be signed out.

Use Trinity College Dublin’s Long Room as the current virtual-library refinement reference: rhythmic oak vault bays, fitted timber lining, classical fluted bookcase pilasters and restrained metal details. Adapt these to the existing four-storey rotunda and its entrance-to-fireplace axis; preserve the clear central floor, reception orb, real catalog books and room interactions. This supersedes the fan-vault ornament direction.

The user's full 1:1 Long Room reconstruction request supersedes ALL earlier rotunda/four-storey, moonlit Gothic, reception orb, fireplace, central-floor furniture, and fictional portal architecture rules. Use the Trinity College Dublin Old Library Long Room's 63.7 m × 12.2 m × 14.2 m interior, two storage levels, axial oak barrel vault, forty side alcoves, timber galleries and historically referenced furnishings. Keep private catalog/reader access functional; distinguish non-interactive historical scenery books from real catalog models. Do not describe guessed joinery or sculpture dimensions as measured. Track references and remaining fidelity gaps in docs/verification/trinity-long-room/reference.md.

Global forms need visible grouping: use shared bk-form-section panels, white editable controls in light themes, stronger control borders and primary-colored labels. Preserve clear contrast in Night mode. This supersedes the rejected unfilled, low-contrast form treatment.

After reviewing the measured Long Room, the user explicitly requested a much larger hall. The current experience expands the architectural envelope to 90 m × 18.3 m × 20.4 m while preserving human-sized books, busts and display cases. Retain the source dimensions separately; do not claim this enlarged experience is a strictly measured 1:1 replica.

The user explicitly authorizes reconstructing missing Long Room data from public documents and photographs. Continue with source-linked dimensions and clearly identified estimates instead of waiting for a complete scan. Keep date-consistent references, preserve the enlarged experience and existing performance optimizations, and record evidence in docs/verification/trinity-long-room/public-reference-data.json.

The user rejects the rough Long Room floor, ceiling and flat lighting: refine visible timber surfaces and architectural/contact shadows while preserving responsive rendering. The second level must have an obvious usable stair and continuous human-width walkways. Any circulation added for the enlarged hall must be identified as an adaptation, not surveyed original geometry.

Hall exploration must move forward along the view direction beyond the former orbit zoom cap. Preserve collision descriptors during static mesh batching, include upper bookcases and gallery/stair guards, and apply collision to guided gallery travel. Shelf focus must use a clear stand point rather than animate through intervening shelves or the historic spiral. Stairs need supported rest landings and a clear transition into the gallery.

The latest user review requests wider horizontal space, shorter bookcases with a complete shelf-focus view, real catalog category zones, visible modeled lamps, more detailed window joinery, coherent curved vault geometry and no repeated crude statues or central display tables. The active adaptation is 90 × 22.3 × 18.45 m, with a 14.2 m clear central aisle, 5.4 m lower cases and a 5.95 m gallery. Historic sculpture studies stay in the component review route until distinct likenesses are acceptable; do not repopulate the hall with generic duplicates. Keep central display tables and the harp display cabinet out of the live hall. These usability/proportion requests supersede the former enlarged dimensions while preserving source measurements separately.

The user requests removal of the basement. Remove the central descending visitor stair, lower landing, associated lights and blocking volume, and close its floor aperture with continuous timber flooring. The later original-stair review also supersedes the freestanding gallery access stair: route upper-gallery access through the photo-derived iron alcove spiral and close the obsolete rail opening. Preserve explicit estimates rather than claiming exact surveyed geometry.

The repeated basement-removal request also removes both live descending pavilion stairs and lower arrival spaces. Keep level room connections, continuous collision-supported floors, and first-to-second-floor stairs; remove east/west downward navigation buttons. Historical lower stair studies remain isolated references, not live hall geometry.

The user removed the guided second-floor stair viewpoint and the live service stair, Fagel pavilion, and west upper storage areas. Remove their navigation and walking routes, omit these areas from live construction, and seal their former portals with solid geometry and collision. Retain the main hall, real catalog interactions, and Henry Jones room; historical component studies may remain isolated.

Visible books in the live virtual library must correspond one-to-one to the current real catalog. Do not generate anonymous historical filler books on empty shelves. Render current catalog covers and actual titles on book spines; keep binding appearance stable by book ID when ordering changes. Historical filler belongs only in isolated reference studies.

Real catalog books must read as ordinary paper books: restrained thickness, thin covers, inset page blocks and fine spines. Keep proportions consistent on shelves and during inspection; avoid oversized slab-like covers or thick colorful bindings.

The live Long Room east and west ends are continuous timber walls. Remove their lower and upper door openings and leaves, paired arched niches or window-like treatments, pediments and associated architraves from the live hall, and enforce solid collision boundaries. Keep Henry Jones available through a direct area switch without routing the camera through the sealed west wall; retain the former end compositions only in isolated historical studies.

The live historic spiral-stair alcove omits its lower and upper transverse bookcases so the stair reads as one clear, harmonious bay. Also omit the entrance-end north-side transverse case selected in the 2026-09-15 review at both levels, together with its shelf marks, case-mounted lamps, unsupported ladder and collision/click targets. Keep the adjacent window, end wall, continuous gallery floor, railing and balusters, and exclude both removed sections from real-catalog slot allocation. Historical reference assemblies may retain the former cases.

Virtual-library keyboard navigation uses continuous, frame-rate-independent camera-relative movement: W/S move forward and back, A/D strafe left and right, diagonal input keeps the same speed, and all motion retains scene collision. Keep this behavior in both the Long Room and the Henry Jones room.

The live virtual-library overlay does not expose a Henry Jones room switch. Start the control panel with the walking/catalog controls and keep the Henry Jones architectural model separate from the visible navigation UI.

The live virtual-library walking eye height is 1.78 scene units above the current floor or route. Keep that modestly raised view consistent across free WASD movement and any retained guided route.

The live historic spiral stair sits at x=-8 and z=41.1825, with its aisle-side edge aligned to the lower-case line instead of recessed toward the rear wall. Keep both wall lamps out of this stair bay. Move its gallery aperture, upper landing, guided path and collision geometry together whenever this anchor changes.

Do not render shelf-letter marks in the live historic spiral-stair bay after its lower and upper transverse cases have been removed. Historical reference assemblies may retain those marks with their restored cases.

The transverse case immediately beyond the live spiral-stair bay is single-faced. Its +z face toward the stair is a finished back without open shelf boards, books, shelf letters or shelf furniture; retain the -z shelf face for the following alcove and for future real-catalog capacity. Historical reference assemblies may retain both faces.

The user removed every window-end double reading stand from the live Long Room. Do not restore these paired lecterns, their shaped lettering cartouches, or their circular scroll-relief supports anywhere in the hall.

Focused real-catalog shelf books must be easy to select and must read as a compact, nearly contiguous run rather than isolated thin sticks. Keep a separate, non-rendered raycast target of at least 0.16 scene units around each spine, leave only a hairline gap between adjacent targets, use a broad visible binding, and render at most five large glyphs from the real title with a high-resolution, high-contrast spine texture. Keep the virtual-library renderer above 1× resolution on high-density screens when performance allows so the spine lettering stays crisp.

Selecting a real catalog book must pull that same 3D model a short controlled distance straight out of its shelf and turn its cover toward the focused view while preserving its exact shelf scale on every axis at the default 1× zoom. Do not move it into a separate oversized inspection pose. User-controlled zoom may multiply the preserved shelf scale, and closing or switching inspection must restore the previous book's exact shelf transform.

The live spiral stair needs a continuous outer guard and handrail from the first tread through the tread before the final exit, leaving only the last exit sector open, plus guards along both upper-landing edges. When retired east-end rooms are omitted, close their obsolete opening with the full gallery handrail, balusters and matching collision; do not leave an unguarded gap beside the stair.

The latest selected-book review supersedes the shelf-scale-only inspection pose: animate the same catalog model out of its slot into a controlled, readable preview on the left side of the focused-bookcase view, facing the camera. Keep it separated from the remaining shelf hit targets so direct book-to-book switching still works, preserve its proportions while preview scaling, and restore the exact shelf transform on close or switch. Use six generous shelf tiers rather than ten in both lower and upper live cases; derive catalog-book height and resting position from that shelf pitch. Retain 120 catalog slots per section by using twenty books per row instead of reintroducing cramped vertical tiers.

Reader top navigation and document bodies use the same responsive maximum width: `readingMax` below the tablet breakpoint and `contentMax` at and above it. Apply this consistently to EPUB, PDF and demo reading surfaces so the header and body remain aligned at every viewport size.

Render the selected left-side book preview as a dedicated foreground 3D pass with its own depth buffer. Scene walls, ladders and bookcase parts must never cut through or erase the preview model, while the model's own cover, page block and spine still retain correct internal depth. Keep the default desktop preview close to one third of the viewport height so the cover is clearly readable, and leave user wheel scaling bounded.

Real catalog book models must remain refined at both shelf and inspection scales: use the actual cover inside a thin binding lip, an inset textured page block, a rounded spine, restrained shoulders, caps, hinge grooves and headbands, plus a crisp high-contrast serif title. Keep those details inside the existing consistent proportions and never regress to plain colored slabs or oversized antique bindings.

While a real-catalog shelf is focused, keep the camera at its controlled selection viewpoint: disable the visible forward and back controls, ignore movement-key walking, and never collapse the shelf as a side effect of a walk request. Restore walking only after the user explicitly exits shelf focus.

Do not render the historical benefactor-name plaques or their green-and-gold frieze panels in the live Long Room. Keep the names only in source/reference records, and do not restore these plaques without a new explicit user request.

The default Long Room entry view and the hall view restored after collapsing a focused shelf must use the same camera height. Reset the shelf-focus pitch to `LONG_ROOM.camera.pitch` while preserving the current horizontal facing direction.
