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

The main hall's interactive catalog layer must render exactly one 3D book model for each real catalog book and must not fill empty shelf space by repeating titles. Keep each unselected model naturally inserted between shelf boards, and pack real books assigned to the same shelf row into one centered contiguous run instead of leaving an arbitrary central gap. Shelf focus moves only the camera and persistent frame. Clicking a real book may pull that original model forward within the current focused-bookcase view for cover inspection, drag rotation, and wheel scaling; a short press and release on that same inspected model opens `/reader/:bookId`, while a drag continues to rotate it. Clicking another visible shelf book must switch inspection directly without a reset. Never move a book to the reception desk or spawn a duplicate floating model, and always restore its exact shelf transform when inspection closes. Non-interactive office background volumes are governed separately below and must never reuse catalog titles or cover textures.

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

Display-book management lives at the top-level /display-books route and is linked from the signed-in main navigation. Settings now contains library roots and reader fonts only. Redirect /settings/display-books and /settings#display-books to /display-books.

All page-level action toolbars align to the right edge, including Create User, refresh, add and upload actions. Keep the separate toolbar row below the header or tabs; this supersedes earlier left-aligned toolbar guidance. Use shared ActionToolbar for dedicated action rows and PageHeader actions.

Moving a book between libraries shows its current library, a destination library selector, validation, and confirmation. Preserve its relative path automatically; keep fingerprints and staging details behind the server safety flow rather than asking users to enter paths.

Show operation feedback and error notices through the shared Ant Design bubble notification provider, outside page flow. Preserve retry actions and dismiss controls; success notices auto-dismiss. Keep a token-based gap below standalone settings save toolbars.
