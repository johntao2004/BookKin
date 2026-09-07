# Login screen visual QA

## Source and implementation

- Source visual truth: `/var/folders/k4/mgjk9gsj2q16n5_csyg45bp40000gn/T/codex-clipboard-bd3ff1c3-2ec8-48c3-b85a-8bb175f31b2e.png` (user reference, 2644 × 1748 source pixels; displayed at 1936 × 1280).
- Implementation: `http://192.168.1.103/login` (captured from the Codex in-app browser after the release was accepted).
- Implementation viewport: 1327 × 886 CSS pixels; the captured page has no horizontal overflow.
- State: logged-out login page, registration policy disabled, empty fields, password hidden, username field focused.
- Density normalization: comparison was made at CSS layout level because the source screenshot and browser capture use different pixel densities.

## Comparison evidence

- Full view: the implementation keeps the BookKin split-screen composition, a distinct right-side panel, a top-left return action inside that panel, and a narrow centered login column.
- Focused right-panel view: the implementation now presents the greeting, title, explanatory copy, two fields, password visibility control, and primary login button in one compact vertical rhythm. The registration affordance remains conditional and uses an inline link when the server policy is enabled.
- Interaction checks: the return link targets `/library`; login controls are present; browser console error log is empty.

## Findings

- [P3] Palette and imagery differ from the reference. The implementation intentionally retains BookKin's warm paper palette and original mountain cover, as required by the product design tokens and original-brand boundary. The reference was used for structure, spacing, and hierarchy rather than copied branding or artwork.

## Comparison history

1. Earlier implementation placed the return action in the form content and left the right panel visually undifferentiated.
2. The fix moved the return action to the top-left of the right panel, added the panel divider/surface, added supporting copy, and changed conditional registration to an inline footer link.
3. Post-fix capture at the deployed login route showed the intended hierarchy, no overflow, and no console errors.

## Implementation checklist

- [x] Right panel has a stable surface and divider.
- [x] Return action is top-left within the right panel.
- [x] Form width and vertical rhythm are compact at desktop size.
- [x] Registration remains conditional on the server policy.
- [x] Existing BookKin tokens and assets are preserved.
- [x] Login route and primary controls were browser-checked.

final result: passed
