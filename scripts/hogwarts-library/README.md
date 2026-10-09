# BookKin high-detail modular library

## Current revision

`20261009-walk-clearance-r4` preserves the 30×36 envelope, 6.2 gallery level,
18.7 vault crown and 28 double-faced cases. It locally repairs walking clearances,
full-row book/cabinet spacing, stair landing support and model-derived collision.
Dimensions are estimated model units, not surveyed dimensions from the reference.

The current exported source contains 1,554,611 triangles. The 13 runtime GLBs are
lossless spatial modules of that exact export, sharing 28 materials and 11 images.
Material definitions, image bytes, texture definitions and samplers are unchanged
from the approved detailed reference baseline. No coarse replacement is used.

- Upper case interval: 11.10–14.58 (mirrored on the left), width 3.48
- Upper passage center: ±10.1125; narrowest measured door width 1.805
- Lowest front/back doorway tracery headroom: 3.05 above the 6.2 gallery floor
- Ground and stair walking eye height is a separate runtime contract
- Scene configuration: 1,132 descriptors, including 60 local-height helical arcs
- Both routes begin on clear ground at (±6.64,0,-14.55)
- The stair stringer terminates flush at 6.2; gap-side exit infills and supported
  aperture guards preserve the full walking footprint

The final source GLB SHA-256 is
`7a892bba063d3ceef2f009233c1956662914c1f1f790b98b7701415b83513aef`.
See generated reports in `docs/verification/reference-library-*.json` for exact
module hashes, byte counts, triangle equivalence and measured clearance samples.

## Runtime package

- 13 bounded spatial/semantic GLBs in `apps/web/public/assets/hogwarts-library/modules/`
- `library-manifest.json` records exact bounds, counts, priority and hashes
- `materials.gltf` owns canonical materials, texture indices and samplers
- 11 PNG images are shared by content hash, without recompression
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

Use Blender 4.3.2, Python with NumPy/Pillow and pinned Node dependencies:

```sh
pnpm install --frozen-lockfile
python scripts/hogwarts-library/material_maps.py
blender --python-exit-code 1 -b -t 2 \
  --python scripts/hogwarts-library/build_library.py -- --stage full
python scripts/hogwarts-library/verify_glb.py
node scripts/hogwarts-library/export_modules.mjs
node scripts/hogwarts-library/verify_modules.mjs
blender --python-exit-code 1 -b \
  --python scripts/hogwarts-library/verify_walk_clearance.py
```

Both `sculpture_helpers.fragment` and `walk_clearance_colliders.fragment` are
required original helpers. The latter supplies bounded shells following actual
carved openings, arcade shoulders and suspension wires. Do not replace these with
full-height cylinders or oversized solid doorway barriers. The exporter validates
its triangle count against the current source instead of a stale fixed revision.

The portrait input and `PORTRAIT-NOTICE.md` remain with the package. No game mesh,
extracted texture, screenshot plane, logo or NPC is included. All visible live
shelf books must continue to map one-to-one to the authorized catalog.

## Verification and performance boundaries

`verify_walk_clearance.py` reimports the exported source GLB and checks all 14 upper
openings, 84 six-row case samples on both book faces, wall/cornice gaps, supported
aperture guards, flush stair exits and route head clearance. The exact-triangle
proof binds these geometry measurements to the 13 delivered modules. Runtime
body-envelope and actual-book tests are owned by the web test suite.

Fixed-camera before/after images are offline Blender renders of actual exported
geometry. They do not prove browser navigation, GPU frame rate or interaction.
The latest eight user reference views informed spatial relationships; the model
still differs in sculpture likeness, exact pointed tracery, end-wall carvings and
other reference-specific details. This is not a claim of complete reproduction.

Native multi-draw uses material batches with per-object culling. Unsupported
browsers consolidate resident geometry by material. Static shadows are refreshed
when geometry changes. Browser/GPU acceptance requires an actual supported
browser; CPU counts and Blender renders are separate evidence.
