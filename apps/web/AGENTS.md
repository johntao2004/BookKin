# Prototype Instructions

All rectangular UI surfaces share a fixed 7.416408px radius (12px / golden ratio), regardless of component size. Keep radius/xs through radius/2xl equal in design/tokens.json, including cards, covers, controls, dialogs, menus and tags. Never use percentage radii or component-size-derived radii for rectangular UI. Preserve intentional circular avatars, status dots, swatches, switches and loading indicators; zero remains valid for flush structural edges. Legacy numeric sx borderRadius values resolve to the shared radius instead of a multiplier. This supersedes earlier small/large corner-radius distinctions.

For library pagination, show only the shared loading spinner while fetching more books; omit the paragraph skeleton and visible loading copy.

Keep full-page 401, 403 and 404 states concise: show the status, title and recovery actions without a secondary explanatory paragraph beneath the title.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

The library book grid is intentionally static: do not add hover zoom, lift, transform, or stronger-shadow effects to book cards or covers. Preserve visible keyboard focus and working card actions.

The public homepage header must not show a display-book count badge.

Use PageContainer and PageHeader for standard page headings. Show an English eyebrow and the Chinese page title, with page-level actions when needed; standard headers do not include introduction descriptions. Keep top spacing consistent and do not recreate shared typography or override page-top padding on listing or management pages. Put business metadata, status and necessary operating guidance in the page content. Embedded settings headings may retain an `embeddedDescription` for relevant configuration help.

Keep the navigation drawer and its content at one shared width. Put BookKin in the drawer header beside the close control, and inset navigation items evenly instead of adding a second brand section inside the body.

Use a compact Ant Design dropdown for the global theme selector, aligned to the trigger's right edge; close it automatically when the pointer leaves the trigger and menu region.

Keep global navigation, standard page content and reader frames on the shared full-width rule, with fixed responsive horizontal gutters of 12px below 768px and 24px from 768px upward. Do not center-limit these outer frames with a maximum content width. Align the outer navigation controls with the content edges.

The header search must expand on mouse enter and also support clicking on touch devices, focus its input, and collapse on mouse leave, blur or Escape while preserving the query. Keep its expanded field within the viewport on phones. The theme dropdown must also open on mouse enter.

The library book-action menu uses one `编辑元信息` entry for cover, title, and other bibliographic fields; do not split `更换封面` or title editing back into separate menu items. Keep NAS location changes such as `移动` as independent file operations so they continue through fingerprint validation and the safety-preview flow.

The library homepage includes a compact recent-annotations module beneath the latest-book card, in the same content flow rather than as a separate column. Show only the signed-in user's newest private annotation, link back to the exact EPUB CFI or PDF page when available, and keep a clear empty state without adding goals or streaks.

The library page starts with its single `LIBRARY` / `藏书库` PageHeader with a show/hide overview control. Persist the overview choice per user; hiding it leaves all catalog tools and books available. Follow it with the four-card overview, then a semantic `全部藏书` h2 beside the page tools and finally the catalog results or empty state. Put the upload action first, then format and sort controls in that tool row; show upload only to users with management permission and retain its existing dialog behavior. Keep the query-result count below that secondary heading row rather than in the page header. On desktop, center the heading and right-aligned tools together; on phones, place the heading above the tools, give upload its own full-width row, and keep format and sort side by side without overflow. Do not repeat either heading or action. The overview uses one column on narrow screens, a two-by-two composition from tablet through standard desktop widths, and one row of four equally sized cards from the tokenized 1920px wide breakpoint upward. Keep the existing equal 336px overview-card height and responsive padding in every data state, including an empty catalog or empty search result; do not compact or collapse the overview for empty books.

Keep overview cards at the shared token-derived 336px height rather than 480px. Use skeleton placeholders for library overview, statistics, annotations, and catalog loading; do not flash zero-data empty states before requests finish.

The featured-book cover in the overview must visibly clip all four image corners using the shared radius token. Keep the image box fitted to its natural aspect ratio within the cover slot; do not apply rounding to a larger letterboxed image box whose corners never touch the visible cover.

The four library-homepage overview cards share one visual hierarchy. Keep every section label at the same top-left inset with the same display font, weight, line height, and same-size leading icon; use contrast-aware color only where a dark card requires it. Treat the featured book title, weekly duration, newest annotation content or empty state, and current-reading title or empty state as one secondary tier with matching typography and vertical rhythm. Do not enlarge or detach one card's section icon, vertically center a section label, or omit the featured-card icon.

Keep overview-card actions sparse: the featured card has only `开始阅读`, the recent-annotation empty state has no reading CTA or description, and the reading-progress empty state has no book picker; show `继续阅读` only after a real position exists. Render both lower-row zero-data states through the shared `OverviewEmptyState`; keep their shared heading level and token-based layout, omit the description for recent annotations, and retain necessary reading-progress guidance. Anchor every overview empty-state heading at the same `spacing[4]` top offset after its card header regardless of description; retain the `spacing[20]` minimum height without vertical centering. Do not reserve an invisible section-icon column inside the reading-progress content. Express weekly comparison as a percentage increase, decrease, or zero change, and leave the area beneath the weekly chart empty instead of adding an accumulation hint.

At tablet widths, the library upload, format and sort controls may share one right-aligned row beside the catalog heading; on phone widths, keep upload full width above the side-by-side filters.

On the reader-font management page, start each font card directly with the font name and metadata; do not add a leading font-icon tile. Show only the status switch at the right edge, without visible `启用` or `已停用` copy beside it, and preserve an action-specific accessible name on the switch itself.

End the reader-font management page at the font list. Do not add a trailing divider or explanatory paragraph about disabling fonts and fallback behavior.

In the font-upload form, keep the title and description above a single shared field grid. From the tablet breakpoint upward, use equal-width name/license fields in the left `minmax(0, 1fr)` column and the font-kind select/file button in a right column sized from five touch-target units, with a token-based 16px gap. Align the first row's name and kind fields, then align the second row's license and file button; all controls are the shared 44px touch-target height and labels use the shared 8px gap. Place left-aligned file-format/size guidance on its own full-width row below the controls. Below the tablet breakpoint, stack the fields and keep the file button full width without horizontal overflow. Preserve the accepted WOFF2/WOFF/TTF/OTF formats, 25 MB limit, automatic create-and-upload flow, progress/errors, enablement, permissions and API behavior.

Authentication screens retain the full-height `mountains-autumn.jpg` artwork on the left and the form on the right. Remove artwork slogans and shared introductory descriptions. Do not display greetings on authentication pages or relocate them to other pages without a new user request. Use direct page titles such as 登录, 注册, 忘记密码, 重置密码 and 修改密码 through the shared PageTitle. Align BookKin to the homepage's brand font, 64px tokenized navigation band and shared 12px/24px gutters; align the return link and form to the same right-panel gutter. Hide the artwork on small screens and keep the brand and return link in one header row. Show the owner-initialization link only when the public setup-status check explicitly reports an uninitialized library; hide it while unknown, on failure and after initialization, and redirect direct `/setup` visits once initialization is complete.

Keep anonymous access limited to the explicit public discovery surface: `/library`, `/categories`, `/booklists`, `/search` (public results only), and public-book reading. Every private library, annotation, display-setting, recycle-bin, virtual-library, password, and administration route must pass through `RequireAuth`. A signed-out direct visit must render the dedicated 401 access page without mounting protected content; an authenticated role mismatch must render the 403 variant instead of silently redirecting. Preserve the attempted path, query, and hash when sending a signed-out visitor to login.

The PDF reading-mode viewport must clip offscreen virtual columns at the inner page boundary. Use a single page below the tablet breakpoint and a two-page spread from the tablet breakpoint upward; at single-page, spread, and phone widths, no fragment of an adjacent virtual page may remain visible. Verify virtual-page navigation and zero horizontal overflow in the browser.

Place the PDF previous/status/next navigation directly below the current reading page or spread, in normal document flow. Treat that bottom navigation as the reader-generated page label; do not add a second standalone `第 N 页` footer inside reflowed PDF text. Preserve page numbers that are part of the source PDF itself and keep scanned-page accessibility/status copy distinct from pagination.

Reader annotation actions are incomplete until the saved style appears immediately inside the visible article without a reload. Verify highlight, underline, and bold live in EPUB and paginated PDF locators, including PDF locators with a virtual-page `&offset=` suffix.

The reader's Paper, Bright, and Night themes are whole-site themes. The global shell and reader settings must share one persisted choice, and every route, dialog, menu, form, card, and management surface must use semantic theme colors instead of assuming a light background.

The reader settings menu includes a persisted `翻页效果` switch that is enabled by default on mobile. Desktop and larger viewports must always change PDF, EPUB, and demo pages immediately without the WebGL curl or fallback animation; on mobile, turning the switch off must do the same.

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

Keep administrative functions out of public navigation according to their role boundaries. User management now lives inside Settings as its first option, with Settings as the account-menu entry. Do not repeat them in the desktop primary navigation or mobile drawer, and preserve their protected routes. Order the authenticated reader-facing navigation as `首页`, `藏书库`, `分类`, `书单`, `阅读笔记`, `虚拟书库`.

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

The four library overview cards must have equal widths and equal heights: use two equal columns on tablet and four equal columns from `layout.breakpointDesktop` (1440 CSS pixels), and retain the shared 336px row sizing in every state. Keep the dark reading-progress card's 1px border the same color as its background so all four card headers and content share the same inner origin. Do not restore an asymmetric featured/statistics split or change the empty-state title's 16px top offset/minimum height; the title aligns with neighboring card content and cannot drift when its description changes.

LAN HTTP is a supported deployment origin. Generate client UUIDs through utils/random-id.ts using crypto.getRandomValues; never call secure-context-only crypto.randomUUID directly. Test file queue selection with randomUUID unavailable.

Production acceptance must exercise LAN HTTP file selection and upload parsing, not only localhost, HTML and health. Preserve the application error boundary so render failures display a recovery action instead of blanking the screen. Clipboard actions must handle unsupported origins and rejected permissions.

Keep upload dialogs compact and viewport-bounded, with a scrolling content area and reachable fixed title/actions. Use the small dialog width for the queue and medium width for metadata review; do not force mobile uploads into full-screen dialogs.

Ant Design 6 Modal shell styles use the container semantic slot, not the obsolete content slot. Keep shell padding zero so title/content/actions supply exactly one layer of token-based padding.

Keep the library metadata editor compact: retain only the separator between cover controls and bibliographic fields, place the original-file writeback checkbox directly after the description, and never reintroduce an extra modal-body padding layer around the shared title/content/actions.

Upload selection or drop starts transfer automatically. Keep one primary upload action, show uploaded confirmation, and navigate to the persistent book-information editor on confirmation. Do not expose the inspection queue or batch commit in the upload dialog. Preserve server validation and staging; metadata editing completes safe ingestion.

Do not show a batch-rename action on the library collection page. Keep individual book metadata editing in the book action menu.

Shared menus and popovers must use their measured dimensions, flip above bottom-edge anchors, respect transform origins, and stay within the visual viewport during scrolling/resizing. Never position them with a guessed fixed menu width.

Settings keeps its section selection in persistent URL hashes and renders only the active operation panel. Preserve role checks and panel behavior, and use `EmbeddedSettingsContext` so existing panels do not add nested page padding or duplicate large headings.

User management is the first Settings section (`#users`) and the default section for owners/admins. Keep user list, operation logs, login logs and security as nested tabs (`#users/operations`, `#users/logins`, `#users/security`). Remove its separate account-menu entry. Preserve authorized legacy `/admin/users` deep links by redirecting to the matching Settings tab.

User management keeps the table from the sm breakpoint upward, including iPad portrait widths; reserve user cards for phones below sm. Keep horizontal overflow inside the table container.

Keep management pages focused on controls and data. Do not restore the static role-permissions information banner above the user table; reserve alerts for actionable current states.

Place Create User on its own right-aligned contextual toolbar row immediately above the user table, separate from the page title and introduction.

Standard page headers show an English eyebrow above the title row, align the title and page-level actions together on desktop, and stack the title and actions on phones. Keep the header-to-content gap at 24px on all standard pages, whether or not a page action is present. Do not add introduction descriptions to standard headers; keep only page-specific business information and necessary guidance in the page content. Use shared PageHeader for this layout and PageTitle for standard primary headings; it keeps h1 semantics without page-level font-size overrides. Application h1/h2/h3 headings share a token-derived responsive scale: 36/28/22px from the mobile breakpoint upward and 28/22/18px below it, independent of legacy Typography variants. All application heading levels use the display font family, regular weight, titleLg line height and normal letter spacing through shared Typography; page-local legacy variants must not change this contract. Body and controls use the body font family and existing body/label/caption tokens. Reader content and explicit font specimens retain their selected typefaces. Embedded headings may keep an `embeddedDescription` and h2 semantics; an embedded `PageHeader` has no bottom margin, so its parent layout owns the single token-based gap to the next form section. Keep authentication, reader and full-screen 3D layouts independent. Keep collection toolbars below their section heading.

Empty collection copy names its business resource: books use `EMPTY_CATALOG_TITLE` (`暂无书籍`), categories `暂无分类`, booklists `暂无书单`, reading notes `暂无阅读笔记`, recent annotations `暂无批注`, and the recycle bin `回收站为空`. Filtered zero results say `未找到匹配的…` for the searched resource. Never use `无书目` as a generic fallback. Use the knowledge graph's Ant Design default Empty illustration through `EmptyState` / `EmptyStateIllustration`; compact surfaces use the same illustration at tokenized size. Page-level collection surfaces retain `BookCatalogEmptyState` and useful actions. Overview cards retain their existing equal height. Keep loading, error, unavailable-file and zero-value statistics separate from empty collections.

On the Categories page, show one page-header action: after a successful empty result, use a contained create action that opens a simple single-column form and keep the shared empty state action-free; with existing categories, use the outlined management action for ordering, editing, deletion and creation. While categories are pending or failed, retain a disabled management action rather than presenting the create state. Preserve the `manage=1` deep link, reset unsaved form and delete state when the dialog closes, and close the direct create form after a successful creation while keeping the full management dialog open after manager-mode saves.

Settings retains five sections: user management (`#users`) first, then library roots (`#library-roots`), reader fonts (`#reader-fonts`), owner-only mail (`#mail`), and AI book matching (`#ai`). On desktop, place an accessible vertical section navigation on the left and the selected operation panel on the right, with one token-based 24px separation; give the panel `min-width: 0` and mount only its selected section. The navigation card's outer edge aligns with the page heading. Its five items use a consistent token-based 12px horizontal inset, 44px minimum target height, and 4px gap inside a semantic card surface with a border and large radius. Use a rounded `surfaceStrong` background for the selected item and a lighter `surfaceSoft` hover; keep primary 16px text, medium weight by default, semibold when selected, and a visible keyboard-focus indicator. Do not show a vertical divider or isolated ink bar, restyle global Tabs, or change other pages. At widths below 768px, retain accessible horizontal tabs above the full-width panel and allow the tab navigation to scroll or expose overflow through its keyboard-accessible menu without widening the page; keep desktop card decoration off mobile. Keep the standard SETTINGS / 设置 page header, and use `EmbeddedSettingsContext` for existing panels; render every section title once in the shared shell, including mail. An ADMIN must not see or access the owner-only mail section; an unauthorized `#mail` hash falls back to an allowed section. Members visiting Settings go to `/profile`. Preserve legacy redirects: `#recovery-email` to `/profile`, `#file-operations` to `/settings#users/operations`, and `#display-books` to `/display-books`. Keep security within the user-management nested tabs; do not add separate security, file-task or display-book sections.

The homepage is the public display catalog. Do not show a separate 展示书目 item in desktop or mobile primary navigation. Signed-in users enter management via the homepage action 管理首页书目, retaining the protected /display-books management route for adding, removing and reordering homepage books. Keep legacy display-setting redirects compatible.

Align page-level actions to the right edge, including refresh, add and upload actions. Keep dedicated contextual toolbar rows below the header or tabs, and use shared ActionToolbar for those rows. Use PageHeader for actions that belong beside a page title.

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

Global navigation, standard page content, reader controls and reader document frames use the same `pageWidthSx` contract at every viewport size: full available width with 12px gutters below 768px and 24px gutters from 768px upward, without a centered maximum-width cap. Do not apply a narrower `readingMax` outer frame at intermediate tablet or small-laptop widths. Apply this consistently to EPUB, PDF and demo reading surfaces so all stacked boundaries remain aligned on phones, tablets and desktops; readable prose measure may be controlled only inside that shared outer frame.

Keep the outer left and right gutters fixed to the virtual-library return control: 12px below 768px and 24px from 768px upward. Do not reintroduce a `contentMax` cap that increases side whitespace on large screens.

Standard pages using `PageContainer` share a token-derived top gap below global navigation: 16px on phones and 24px from tablet widths onward, expressed as explicit pixel values so the UI spacing scale does not multiply them. Do not override this top gap on individual pages. Keep `AuthFrame`, reader viewports and the full-screen 3D library on their own viewport-specific layouts.

Authentication flows that reuse `AuthFrame` (`/login`, `/setup`, `/register`, recovery, and `/change-password`) retain their independent full-viewport layout and are exempt from the standard shared `pageWidthSx` frame and gutters; keep this exception in `AuthFrame` so every auth route shares it.

Keep the shared BookKin site navigation visible on reader routes. Treat the book title, progress and reading actions as a secondary reader control bar beneath it, using the same semantic canvas, divider, responsive gutters and width contract as the rest of the product; EPUB, PDF and demo text surfaces must consume the shared responsive reader-width primitive instead of duplicating breakpoint logic.

Responsive acceptance covers every route, including authentication, account/admin forms, catalog details, EPUB/PDF readers and the virtual library. Check phones (including short landscape), tablets, desktop, 4K and 5K. Reader heights must follow the visible viewport, secondary phone actions must remain reachable, and readable prose measures belong inside the full-width outer frame. Clip paginated PDF/demo columns at their viewport parent, never on the translated article, so later virtual pages remain visible. In compact virtual-library viewports, keep search and an expandable controls entry visible without covering most of the scene; bound control-panel scrolling and WebGL render resolution independently from CSS viewport size. Report desktop viewport emulation separately from physical mobile touch/keyboard validation.

Render the selected left-side book preview as a dedicated foreground 3D pass with its own depth buffer. Scene walls, ladders and bookcase parts must never cut through or erase the preview model, while the model's own cover, page block and spine still retain correct internal depth. Keep the default desktop preview close to one third of the viewport height so the cover is clearly readable, and leave user wheel scaling bounded.

Real catalog book models must remain refined at both shelf and inspection scales: use the actual cover inside a thin binding lip, an inset textured page block, a rounded spine, restrained shoulders, caps, hinge grooves and headbands, plus a crisp high-contrast serif title. Keep those details inside the existing consistent proportions and never regress to plain colored slabs or oversized antique bindings.

While a real-catalog shelf is focused, keep the camera at its controlled selection viewpoint: disable the visible forward and back controls, ignore movement-key walking, and never collapse the shelf as a side effect of a walk request. Restore walking only after the user explicitly exits shelf focus.

Long Room transverse bookcases must read as substantial cabinetry when viewed from the aisle: keep their widened case depth, matching broad fluted end pilasters and collision volumes. Mount one persistent Chinese/English category plaque at the vertical center of both the lower and upper aisle-facing case ends for every live bay, including currently empty cases; both levels use the bay's assigned category, falling back to its default category until real catalog books establish one, and do not use floating signs.

Do not render the historical benefactor-name plaques or their green-and-gold frieze panels in the live Long Room. Keep the names only in source/reference records, and do not restore these plaques without a new explicit user request.

The default Long Room entry view and the hall view restored after collapsing a focused shelf must use the same camera height. Reset the shelf-focus pitch to `LONG_ROOM.camera.pitch` while preserving the current horizontal facing direction.

The clarified 2026-09-15 ladder review removes every timber shelf ladder from the live Long Room but retains the historic iron spiral stair, its open gallery aperture, upper landing, continuous guards and collision shells. Shift raises the free hall camera and Control lowers it continuously; releasing both keys holds the current height. Lock vertical flight together with walking during shelf focus, book inspection, search and guided routes. Retired shelf-ladder studies may remain only in isolated reference assemblies that are never mounted in the live route.

The live Long Room second-floor gallery is a complete four-sided circulation loop, with solid crosswalk floors extending to both sealed end walls and joining the two longitudinal runs. Its four central-void railing turns use supported quarter-circle transitions: stop straight handrails, lower rails and entablatures at their tangent points, carry the curved members and balusters on positive solid floor infills, and never subtract a floor aperture at those joins. Protect only edges exposed to the central void and omit detached or wall-side stub balustrades. Preserve at least 2 m of nominal clear width between the inner rail and the upper-case line so collision clearance still leaves a usable walking route. Live Long Room shelves must not contain anonymous, sample or background bindings: every visible main-hall book must correspond one-to-one to the current authorized catalogue. Reference-only model-review volumes, if retained, must never mount on the live route. Keep the upper pilaster capitals connected to the transverse vault ribs, and keep the chandelier suspension continuous without a detached mid-chain canopy.

The live library's shelf zones use the persisted Thema 1.6 subject-code subset shared by the metadata editor and the 3D scene. Store specific child codes on books; use the parent only as a readable shelf zone. Keep unset subjects eligible for deterministic metadata fallback, and never invent a virtual-library category record or book model to fill an empty shelf.

The user's 2026-10-07 request selects the supplied Hogwarts Legacy library screenshots and the accompanying two-storey modeling brief as the current architectural reference, superseding the earlier Trinity Long Room envelope, sealed ends, single iron stair, and empty central-floor direction. Reconstruct the paired timber spiral stairs, separate A/B ends, deep ground-floor bays, pierced upper screens, blue-gray side vaults and central reading furniture in one editable model. Keep uncertain dimensions and hidden connections explicitly estimated. Preserve BookKin identity, authentication, real-catalog one-to-one book models, selection/reading, staged loading and model-derived collision. Do not present historical screenshots, Blender renders or passing unit tests as current browser verification.

The 2026-10-07 follow-up rejects the coarse first reconstruction and requests materially finer modeled woodwork, tracery, railings, stairs, cabinetry, materials and lighting. The user's final enlargement clarification is width only: keep bookshelf count unchanged and height comparable. Increase the working interior from 24 to 30 wide while retaining 36 length, 18.7 vault crown, 6.2 gallery floor, six bays and existing case count. Move side assemblies outward without scaling books, furniture or stairs. Preserve fixed-camera before/after evidence; do not substitute a wider camera lens for true extra space.

The 2026-10-08 reference review specifically requires continuous gallery/stair-aperture guards, visible floor globe, pale fascia-mounted scholar sculptures and the A-end bronze niche pair, broad square inset-fluted piers with one restrained tapered capital, and upper pierced screens integrated into transverse partitions/cornices. Preserve the 30 × 36 envelope, 18.7 crown, 6.2 gallery and 28 double-faced catalog cases. Verify the actual exported GLB from reference-comparable wide views, an eye-level view standing on the upper walkway, and object/junction close-ups; source mesh presence is insufficient. Use one revision manifest and identical asset bytes across all delivered bundles.

The current reference also includes twelve compact upper-alcove reading desk/chair/green-lamp sets, placed in the deep shelf bays outside the inner gallery circulation path. Keep these supports modeled and collided; leave desktops clear of filler books.

The 2026-10-08 web-performance clarification keeps the approved high-detail library design. Deliver the architecture as exact spatial modules with shared textures/materials, lossless compression and staged Three.js loading rather than a monolithic initial model or a coarse procedural replacement. Preserve sculptures, globe, joinery, proportions, all 28 double-faced cases, real catalog identities and collision continuity. Measure transfer size, decoded/allocated memory and per-pass render work separately; splitting files alone is not an FPS improvement. Native multi-draw may use bounded material batches; unsupported browsers need a stable material-batched fallback. Browser/GPU acceptance requires an actual supported browser, not Blender renders or CPU scene counts.

The user's 2026-10-09 review asks for continued penetration fixes and usable headroom plus left/right clearance along the bookshelf walking routes, with eight new supplied reference views informing local refinements. Check modeled passage space, full catalog rows, stair exits and runtime body/camera clearance together; do not conceal narrow or intersecting geometry with a smaller collision radius, remove catalog books, or replace the detailed architecture with coarse placeholders. Preserve the distinction between exported-model checks and actual browser verification.

## Wide-screen ordinary pages

Ordinary pages enlarge the complete UI, including body portals, using `useOrdinaryPageScale`: scale = 1 + max(0, viewport width - `layout.wideScreenReferenceWidth`) / `layout.wideScreenScaleRange`. The tokens are 1920px / 7680px: 4K is 125%, 5K about 142%, and widths up to 1920px stay at 100%. Keep enlargement gentle; do not use proportional 200%/267% scaling. Reader and virtual-library routes are excluded and must clear root zoom on navigation. Fixed overlays convert displayed coordinates back to logical coordinates, and dialogs use the scaled viewport variables for bounds.

At and above `layout.breakpointWide` (1920px), catalog grids use a shared `bookGridSx` with `auto-fill` and the tokenized 224px minimum card width. Preserve the existing phone, tablet and standard desktop column counts; category browsing uses the same shared grid as the library. Empty tracks must remain when results are sparse so a single cover never expands across the whole display. Loading grids use the same column contract. Booklist hero covers have a token-derived 288px maximum column width. Reading-note summary cards use a tokenized 448px minimum on wide displays. Keep full-width outer page/navigation frames and the existing 12px/24px gutters.

Settings retain the full-width outer surface. Inside it, keep settings content left aligned within twice `layout.readingMax`; mail and font-upload forms stay within `layout.readingMax`. Root status and font cards may add columns on wide screens instead of stretching individual cards. These rules cover ordinary pages; 3D camera projection and model geometry are separate.

The library overview switches to one row of four equal cards at 1440 CSS pixels, including high-DPI screens whose physical resolution is larger than the CSS viewport. Keep the featured cover column at most 40% of the inner card width and 160 logical pixels so the title and reading action remain usable near the breakpoint. This overview threshold is independent of the shared catalog grid wide breakpoint.

## Responsive coverage

Support phones, landscape phones, tablets, laptops, desktops and larger displays through layout reflow. Browser zoom is also a supported narrow viewport; never require users to reset it to make navigation or actions usable. Check actual CSS viewport dimensions, not physical pixel resolution. Verify at least 320, 390, 768, 1024, 1440, 1920, 3840 and 5120 CSS-pixel widths, plus a short landscape viewport. Use the drawer below the tablet breakpoint when the full navigation cannot fit; keep navigation controls at the shared touch-target size. Mobile standard titles and collection empty states use the smaller existing type/spacing tokens; tablet and desktop retain their full hierarchy. Long overview book titles must wrap and truncate within the equal-height cards while leaving reading actions reachable. Popups and dialogs must stay within the visible viewport and scroll internally on short screens.

Keep category browsing filters visually consistent: group category, format and sort inside the same outlined surface, align their labels and controls, and use shared token-based control heights and small corner radii for interactive filters. Retain the shared warm semantic colors and selected-state treatment.

All catalog and booklist empty states reuse `BookCatalogEmptyState`: a full-width dashed-border surface with a transparent background and the shared Ant Design default Empty illustration, centered business-specific heading, theme colors, responsive spacing and corner-radius tokens. Do not introduce page-specific text-only variants.

## Knowledge graph

The knowledge graph is an independent BookKin page at `/knowledge-graph`. Use the user's Ant Design NetworkGraph reference for the force-directed network. Nodes represent concepts extracted from EPUB/PDF body text, backed by exact quotes and page/chapter locations; authors, ordinary tags, and private annotations are not knowledge points. Clicking a concept filters related books; clicking it again or clearing the filter restores results. Clearly disclose sampling coverage and AI configuration requirements, and never fill an unprocessed real catalog with synthetic concepts.

Use outlined buttons by default for secondary actions across pages and dialogs, including clear, retry, cancel, add and return actions. Keep primary actions contained. Explicitly use text styling only for navigation links, icon-only controls and inline reader references.

## Upload and public visibility

New uploads default to public display after confirmed ingestion. Provide a per-book public-display switch both during upload review and in metadata editing; explicit off hides the book from the public homepage while retaining it in the signed-in catalog. Retire the separate display-books settings UI and redirect its old routes to the catalog. Upload areas support click, keyboard and drag/drop without extra inner frames or dialog divider borders. Do not show source badges, target paths, original filenames or fingerprints in the upload editor. Place format, size and page/word counts immediately below the cover. Keep the dangerous cancel-upload action beside online enrichment and the save actions.

Ordinary outlined buttons use the shared light surface and neutral border; hovering uses the semantic soft gray surface and neutral strong border while keeping the normal text color. The reading-progress continue action uses this ordinary button variant, without local primary-button overrides.

Booklist details place the return-to-booklists action at the top. Keep the content heading and unlabeled format selector centered in one toolbar, matching the library catalog heading tier and spacing. Browse book cards use the same borderless outer surface and cover anatomy as library cards.

All catalog book cards on the homepage, library, categories and booklists reuse `BookCardPresentation` and `bookGridSx`; keep cover geometry, typography, spacing and action alignment in the shared component. The title and author occupy the same two-row metadata area with truncation and one fixed-width more-actions trigger. Reading, adding and management actions live in that shared menu according to permissions; do not replace the trigger with page-specific read or plus icons. Do not display the public catalog revision as footer copy.

Keep developer instructions and implementation commentary out of visible product copy, including OCR status, rendering/layout explanations, API/Worker internals and acceptance notes. Preserve actionable errors, necessary file-safety guidance and disclosures about sending content to an AI provider, written in user-facing language.

Cover replacement in upload review and metadata editing must open a visible 2:3 crop frame before uploading. Show the entire image with a draggable, resizable crop rectangle and corner handles; do not use zoom or position sliders. Retain keyboard movement and resizing. Cancel leaves the existing cover untouched; export only the confirmed crop as JPEG.

On the categories browse page, show books directly after the category/format/sort filters. Do not repeat the selected category name, result-count badge, description or category-detail link in a separate row below those filters.

Dialogs omit nonessential instructional and explanatory text by default. Keep only necessary field labels, actionable errors and consequential-operation warnings; do not add routine usage hints.

Use compact shared action menus globally: tokenized 180px minimum width, 14px text, 18px icons and 36px desktop rows. Avoid page-local oversized menu padding or icon margins. Preserve 44px minimum touch targets on coarse-pointer devices.

Use BookGridSkeleton for catalog loading on the public homepage, library, category browse/detail, booklist detail and recycle bin. Keep skeleton covers and text aligned with BookCardPresentation and bookGridSx; inherit shared theme colors, radii and reduced-motion behavior instead of assembling independent cover/paragraph placeholders.

Keep all four Settings panels on one visual contract: a shared shell title, full-width content, 24px section separation, responsive 16px/24px card padding, and matching subsection heading sizes. Keep navigation and content top edges aligned. Express token-valued sx spacing as pixel strings to avoid applying the spacing multiplier twice.

All bibliographic metadata editing uses MetadataEditPage and MetadataEditorForm. Existing-book entry points navigate to /library/books/:bookId/edit; upload review uses the same page shell and fields at /library/uploads/:uploadId. Do not introduce a separate metadata-editing dialog or duplicate form layout. Keep the cover column, field order, visibility switch and responsive layout identical; only workflow-specific fields/actions may differ. Preserve optimistic ordinary saves with rollback notices and explicit safe file-writeback confirmation.

The knowledge graph is a canvas-first workspace. Never restore the full catalog cover grid or per-book extraction buttons beneath it. Show compact related-book evidence only after selecting a concept, in the graph side panel. Keep book selection and batch analysis in a toolbar-opened drawer with text rows; disclose AI text transmission there before the explicit analysis action. Do not auto-analyze on opening the drawer.

Restoring a default book cover requires an explicit confirmation naming the irreversible deletion of the uploaded image. Cancel must not send a reset request. A confirmed reset refreshes cover consumers and queues the retired custom image for prompt fingerprint-checked cleanup rather than retaining it for 30 days.

The header search is a permission-aware global entry point on every AppShell route. Submit with Enter to `/search?q=...`; typing must not change a current page filter. Search visible books, booklists and categories plus only the signed-in user's notes/highlights. Anonymous visitors must never call private book or annotation APIs; key search caches by viewer ID. Keep private-note text filtering on the server before limiting results.

Booklists have only 我的书单 and 家庭共享 sections for signed-in users. Group by ownership, including legacy official lists; do not show a separate official section or offer an official/personal type picker. New lists are personal, with visibility controlling sharing. Anonymous visitors see only the existing public-visibility subset under 公开书单. Preserve existing data and server-side visibility rules.

User-management nested tabs (用户列表、操作日志、登录日志、安全设置) have transparent backgrounds in selected and hover states; retain the underline indicator. The outer Settings navigation retains its selected background.

The generated temporary-password dialog displays the username as plain read-only text, never an editable-looking field. Keep the password read-only with an inline copy icon that copies only the password, and one 完成 action below.

All drawers use the shared native title header: title at the content left gutter, one 44px close control at the right gutter, and matching footer gutters. Use 24px horizontal gutters on desktop and 16px on phones. Do not add a second title/close row inside the body. Untitled custom surfaces must not reserve an empty native header.

Operation-log rows identify the book by its filename stem only; never render source/target directories, storage roots, or paths in text, tooltips or accessibility labels. Keep internal operation path data for the safety workflow.

Booklist listing cards are borderless and shadowless, with no nested framed or padded cover mosaic and no visibility chip. Use one-line ellipsis for both title and description with a compact shared gap, without reserving extra empty lines, so metadata aligns across neighboring cards; keep visibility controls in the edit form.

User management includes 在线会话 immediately after 用户列表. List all active sessions without exposing cookie/session credentials. Exiting all sessions requires confirmation and preserves role restrictions. Administrative revocation gives existing sessions a 30-second save window and does not affect subsequent logins. Security settings expose owner-only maximum session age (5–43200 minutes, default 1440); enforce it server-side and notify clients to flush reading writes before logout. Keep failed reading positions and unfinished note drafts per user for recovery without cross-account replay.

The authoritative local library model is 20261020-terminal-arches-r42, retaining r31 architecture and replacing the foreground table group with the existing floor globe. Keep one active asset manifest, scene config, editable source and runtime revision. Do not revive r4, older decorative sculptures/lecterns, or unrelated low-poly branch models. Historical verification records and Git history are evidence, not alternate selectable model versions.

The booklist organizer uses drag sorting without duplicate up/down buttons. Omit the count beside 当前顺序 and keep that column narrower than the add-books column on desktop.

The knowledge analysis drawer hides the scroll track while retaining scrolling and keyboard focus. Append 24 books when reaching the bottom instead of pagination, reset the batch on search, and omit the bottom analysis disclosure paragraph and settings link. The select-all control applies to loaded rows.

虚拟书库通过移动视角步行进入楼梯，不显示左侧楼梯和右侧楼梯快捷按钮。

The user removed the freestanding ground-level column screens at both ends of the reference hall. Keep the A-end six piers/five arches and B-end three balcony piers/two arches, associated brackets and collision shells absent. Preserve the rear artwork, walls, paired stairs, balcony platform, rails and horizontal beams.

虚拟书库控制面板不显示分类快捷按钮。

B端二楼阳台后墙保持开敞，移除六根装饰柱及中央大拱、两侧尖拱装饰；保留墙体、上层壁板、横梁、阳台地面与护栏。

The foreground central reading table at z=10.2, its two benches and lamps are removed. The single globe stands on the projecting A-end upper platform beneath the central portrait, at x=0, z=-15.0, with its base on galleryY=7.44 and collision lifted with it. Preserve the other two tables and the ground-level magic search orb.

Upper A-end artwork mounts directly against the continuous stone end wall. Do not add separate raised stone picture-background panels: their top edges intersect the descending cross-barrel soffit and expose tracery across stepped wall cuts. Preserve the individual timber picture backs, frames and canvases.

End-gallery timber ribs must project below the blue soffit with a real recessed joint. Keep their visible inner profile separate from the ceiling; never start an arch ring on the identical shell curve, which creates coplanar brown flicker.

虚拟书库返回按钮与右侧控制区使用一致的深色金边样式。一楼原地球仪位置（x=0、z=8）的藏书搜索魔法球放大为2.6倍基础模型，使用低饱和暖琥珀烟晶、黄铜底座和克制发光，不使用突兀亮青色。点击打开自动聚焦的紧凑搜索框，空查询只显示输入框，输入后显示可阅读和定位的结果；不添加大外框，并适配窄屏。

Gallery side guards use the giant piers as shared structural newels. Split horizontal members at pier shaft faces and keep independent newels and scroll infill outside each pier footprint. Preserve the guard collision envelope; do not disguise intersections with material depth or render-order changes. Validate the exported GLB with verify_gallery_pier_joinery.py and inspect oblique views.

Both outer walls use the same six recessed windows on each floor (24 total). Generate matching physical apertures, glazing, mullions and inward-facing area lights on both sides; retain sealed exhibition end bays and continuous safety collision along the outer walls.

B端一楼两块罗盘装饰壁板之间设置一扇关闭的深木色双开门，配黄铜把手和实体碰撞；门扇与框不产生共面闪烁，不默认连接或新增房间。

The longitudinal entablature below the upper piers is one closed extruded profile across all six bays. Never restore per-arch cap strips shorter than the bay spacing or stack rear fascia boxes to conceal their gaps. Both sides must have constant front depth at pier boundaries and span centers; verify_gallery_entablature.py checks the exported geometry.

Close the lower arcade shoulders to every shared five-unit bay boundary; the outer arch half-span alone leaves a .21-unit slit. Tie both ends into the actual z=+/-20 walls using high timber shoulders and the continuous entablature, preserving the open circulation below and omitting freestanding end-screen columns. Keep visible solids and flight collisions synchronized.

Terminal lower bays at z=+/-17.5 repeat the same round arch, patterned blue soffit and timber frame as the six middle bays; never substitute a rectangular timber board for these openings. Retain narrow wall jambs at z=+/-20. Crosswalk fascia and longitudinal entablature use shared diagonal profile stations without overlapping top faces or exposed joint caps.

Article import, capture review and editing use the shared right-side Drawer rather than a modal. On phones the drawer fills the viewport width; keep the header and preview/save footer fixed while the form body scrolls independently.
