# Third-party notices · V2.13

The scene geometry, procedural textures and interface were created for this deliverable. The V11 update embeds four reference photographs supplied by the user, used through projective UV mapping to preserve the original interior and exterior calligraphy and dais ornament. These are not claimed as original project artwork. No external model pack is embedded.

The V7 ornamental images `assets/palace-frieze-v7.png` and `assets/throne-relief-v7.png` were generated for this project using the user-supplied architectural references. They are used as surface artwork on the original Three.js geometry. They are not scans or reproductions of museum texture assets.

The V8 textile image `assets/imperial-carpet-v8.png` was generated with the built-in image-generation tool for the reference-led carpet redesign. It is a 1254 × 1254 original woven dragon-and-cloud field, mapped at a uniform physical scale. The carpet bodies, fitted borders, fretwork, throne and ritual objects are original code-generated geometry. The complete asset brief and integration are recorded in `docs/assets-v8.md`.

## Three.js 0.180.0

Copyright © 2010–2025 Three.js authors. Distributed under the MIT License.

- Project: https://threejs.org/
- Source: https://github.com/mrdoob/three.js
- Complete license: `licenses/three-MIT.txt`

The HTML loads a separate JavaScript bundle containing Three.js code and OrbitControls. Embedded license comments are retained by the bundler.

## esbuild 0.25.10

Copyright © 2020 Evan Wallace. Distributed under the MIT License.

- Project: https://esbuild.github.io/
- Complete license: `licenses/esbuild-MIT.txt`

esbuild is a development dependency; users do not need it to open the finished HTML.

## Noto Serif SC

The supplied `MingLibrarySerif.woff2` is a character subset of Noto Serif SC, using the SIL Open Font License 1.1. Its shared CSS family is `BookKin Serif`, registered in `/assets/fonts/bookkin-serif.css`. The bundled `Noto Serif SC` unicode subsets provide fallback coverage beyond this interface subset.

- Upstream font: https://github.com/google/fonts/tree/main/ofl/notoserifsc
- Complete license and copyright notice: `assets/OFL-NotoSerifSC.txt`

The subset includes the characters required by the supplied scene and interface. If adding new Chinese book titles or text in the source, provide a font covering those characters before rebuilding Canvas textures.

## V11 user references and generated assets

`imperial-plaque-reference-v11.png`, `imperial-left-couplet-reference-v11.png`, `imperial-hall-reference-v11.png` and `wenhuadian-original-v11.png` are unchanged user-supplied reference images. `throne-atlas-v11.png`, `ridge-beast-reference-atlas-v11.png` and `ritual-surface-atlas-v11.png` were produced with the built-in image-generation tool from the specified references. The final exterior inscription uses the user's original photograph, replacing the interim generated inscription. The final nine-figure ridge atlas follows the latest seven-beast photograph, replacing the interim twelve-figure atlas. Generated appearance details are adapted reference artwork, not surveyed museum scans. Detailed provenance, prompts and geometric use are recorded in `docs/assets-v11.md`.

## V12 ceramic surface

`assets/chiwen-glaze-v12.png` was generated with the built-in image-generation tool as a seamless fired-yellow ceramic fish-scale material. It is mapped to the body of the separately modelled ridge-end chiwen; it is not a museum photograph or survey. The primary architectural references and full prompt are recorded in `docs/assets-v12.md`. The original user inscription photographs remain unchanged.


## V13 marked references, projection mapping and sky

The eight marked screenshots supplied for the V13 corrections were used to locate the requested geometry and layout changes. The original calligraphy and hall-reference images remain unchanged. The central stair carpet now uses a front-view projective UV mapping of the existing user-provided hall reference, fitted to real treads and risers. It is intended to form one complete image from the specified entrance viewpoint; a top-down view is allowed to distort the image.

`assets/palace-sky-v13.png` is a generated panoramic sky background made for this project with the built-in image-generation tool. It is not a documentary photograph of the Forbidden City and is not used as evidence of a historical view. Geometry for the grey masonry paving, continuous terrace passages, courtyard edging and branched cypresses was authored in code; no external model pack was introduced. Sky asset metadata and generation provenance are recorded separately in `docs/assets-v13.md`.

## V14 lossless runtime derivatives

The thirteen images in `assets/runtime-v14/` are lossless WebP encodings of existing PNG assets from this project. The original PNG files remain in the source asset directory. Each derivative preserves the source dimensions and decoded RGBA pixels; filenames, byte counts and pixel hashes are recorded in `docs/textures-performance-v14.json`.

These encodings inherit the provenance and applicable rights of their source images described above and in the existing asset documents. They are not new photographs, new generated artwork, surveyed museum scans or a new external model pack. The original user-supplied calligraphy and reference images are not altered. WebP reduces the runtime file transfer size; it does not establish a reduction in decoded GPU texture memory.

V14 geometry caching, spatial batching and render scheduling were authored in project code. The runtime continues to use Three.js 0.180.0 and the build uses esbuild 0.25.10; this update does not introduce an additional runtime framework.
