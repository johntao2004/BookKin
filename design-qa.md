# Virtual library front-case removal QA

## Source and implementation

- Source visual truth: Browser Comment 1 from the user, normalized with the same pre-change live view saved at `.artifacts/virtual-library-front-case-removal-20260915/source-before.jpg`.
- Rendered implementation: `.artifacts/virtual-library-front-case-removal-20260915/implementation-after.jpg`.
- Combined comparison input: `.artifacts/virtual-library-front-case-removal-20260915/comparison-before-after.png`.
- Route: `http://127.0.0.1:4175/virtual-library`.
- Viewport: 837 × 706 browser pixels; 837 × 642 CSS-pixel scene canvas below the 64 px application header; 1× screenshot density.
- State: authenticated idle Long Room, camera at x = 0 and z = 41.355, turned toward the entrance-end north wall. Source yaw = -1.8662 and implementation yaw = -1.8588, a difference below 0.5°.

## Comparison evidence

- Full view: the user's selected entrance-end foreground case is no longer present at either storage level. The newly open bay reads continuously from floor to gallery.
- Focused region: the case-mounted lower and upper lamps, shelf marks, case collision/click target, and the ladder that would have lost its support are also absent. The adjacent sash window, timber end wall, gallery floor, continuous handrail and balusters remain visible and intact.
- Interaction evidence: `文学创作 · 4` still focuses section 0 with four selectable books; selecting the first spine still enters the existing pulled-book inspection state.
- Runtime evidence: the live canvas reports 38 shelf sections and a clear camera collision state in the comparison view.

## Required fidelity surfaces

- Fonts and typography: unchanged. Navigation, control labels and helper copy retain the existing type family, weight, size and wrapping.
- Spacing and layout rhythm: passed. Removing the complete foreground assembly opens the selected vertical bay without leaving partial stiles, floating shelves or an unsupported ladder.
- Colors and visual tokens: unchanged. The surviving timber, wall, floor, window and railing continue to use the existing scene materials and application tokens.
- Image quality and asset fidelity: passed. This is native Three.js geometry removal; no placeholder, generated raster or approximate replacement asset was introduced.
- Copy and content: unchanged. No new interface copy was added for the removal.

## Findings

- No actionable P0, P1 or P2 mismatch remains for the selected-region removal.
- Existing unrelated development-console diagnostics remain: Ant Design's Drawer width deprecation and handled static-geometry merge compatibility messages. They were present before this change and did not alter the compared scene output or interaction path.

## Comparison history

1. The source view showed the entrance-end north-side transverse oak case projecting in front of the first window bay, with its lamp and end ladder occupying the user's selected region.
2. The implementation removed that case at both levels and removed its dependent shelf marks, lamps, unsupported ladder, shelf section, catalog slots and camera collider.
3. The post-fix same-view comparison confirms that the selected obstruction is gone while the window, end wall and complete upper-gallery railing remain.
4. Browser interaction then reconfirmed shelf focus and book inspection after the structural change.

## Implementation checklist

- [x] Remove the selected lower and upper transverse case.
- [x] Remove dependent shelf marks, lamps, unsupported ladder and invisible interaction/collision regions.
- [x] Preserve the adjacent window, end wall, gallery floor, railing and balusters.
- [x] Compact live shelf-section allocation so real catalog placement remains continuous.
- [x] Recheck the same camera view, shelf focus and pulled-book inspection.

## Follow-up polish

- The unrelated pre-existing console diagnostics can be handled in a separate performance/maintenance pass if desired.

final result: passed
