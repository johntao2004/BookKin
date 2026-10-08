# BookKin high-detail modular library

The approved round-three design is preserved. The website renders the same
1,552,983 triangles with the existing Three.js catalog/reader interaction layer.
It no longer downloads a monolithic architectural GLB.

## Runtime package

- 13 bounded spatial/semantic GLBs under `apps/web/public/assets/hogwarts-library/modules/`
- `library-manifest.json` describes bounds, byte counts, priority and exact hashes
- `materials.gltf` owns canonical materials, texture indices and samplers
- 11 original PNG images are shared by content hash, without recompression
- `scene-config.json` retains all 367 collision descriptors and both stair routes

Modules use `KHR_meshopt_compression`, bitstream v1, filter `NONE`, and the exact
`INDICES` codec. No float quantization, triangle rotation, decimation or texture
recompression is performed. Local indices use Uint16 only where every value fits;
all ordered triangle corner attributes and material assignments are unchanged.
The bundled Three.js MeshoptDecoder needs no runtime CDN or separate installation.

The original 91,057,412-byte source export has SHA-256
`0cc0db68263287c3bd3f6f30c8f7a58e4c32da8e279912674d5219323ee87a75`.
It remains authoring input, not a committed web payload. Exact module and texture
sizes are in [the generated inventory](../../docs/verification/reference-library-modules.json).

## Rebuild

Use Blender 4.3.2, Python with NumPy/Pillow and the repository's pinned Node
packages. The root dev dependency `meshoptimizer@1.1.1` is the offline encoder;
Three.js already includes the runtime decoder. From the repository root:

```sh
pnpm install --frozen-lockfile
python scripts/hogwarts-library/material_maps.py
blender --python-exit-code 1 -b -t 2 \
  --python scripts/hogwarts-library/build_library.py -- --stage full
python scripts/hogwarts-library/verify_glb.py
node scripts/hogwarts-library/export_modules.mjs
node scripts/hogwarts-library/verify_modules.mjs
```

The builder produces local `deliverables/architecture-uncompressed.glb` and
`deliverables/library-source.blend`; neither is needed by the browser or committed.
The original portrait input is retained with `PORTRAIT-NOTICE.md`; all wood/metal
material maps are generated from deterministic local fields. No game mesh,
screenshot plane, extracted game texture, logo or NPC is included.

`sculpture_helpers.fragment` is an original required helper. Rebuilds may differ
in container metadata; validate the source revision and generated hashes before
replacing released modules. The export script preserves whole triangles crossing
zone boundaries and assigns long-spanning structural faces to the resident core.

## Rendering and performance boundaries

The runtime shares actual Material and Texture objects across chunk parsers,
including Three.js final material variants. Native multi-draw uses dynamically
sized material batches with per-object culling. Unsupported browsers stream first,
then consolidate their fully resident geometry by material; this fallback gives up
fine-grained culling/eviction after consolidation. It is not an on-demand-memory
claim. The directional shadow view covers almost the entire hall and may require
all detail modules to stay resident even on the native path.

Static shadows are refreshed when geometry changes, then reused for camera-only
navigation. GPU performance, mobile acceptance and startup timing require actual
browser measurement. CPU buffer/triangle counts and Blender renders are separate
evidence. The existing rendering loop is capped at about 30 FPS.

To inspect the preserved geometry in Blender, use the source export and the
saved camera rig with `render_export_previews.py`. Its Cycles lighting is not the
Three.js runtime, and those images are not browser performance evidence.
