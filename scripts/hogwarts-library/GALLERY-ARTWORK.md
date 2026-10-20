# A-end gallery artwork provenance

The four flanking paintings were generated with the built-in imagegen tool for
BookKin's original library exhibition wall. They are original compositions,
not extracted reference-game images or copies of identified paintings.

Authoring input: `apps/web/public/assets/hogwarts-library/textures/gallery-paintings-original-r7.png`.
SHA-256: `7a4e9dbd3354887ca5b232789b198e9c0840077b08d3e93908cf8a5fafcfb2ac`.
The generated PNG is preserved without image editing or recompression.

The 2×2 atlas contains, clockwise from the top left: river/stone bridge,
book-and-vase still life, mountain valley, coastal harbor. Wall positions from
left to right sample top left, top right, bottom left, bottom right. Every
painting has its own framed canvas mesh with quadrant-inset UVs to avoid seams.
The original central reader portrait remains unchanged.

The model's source `library-source.blend` packs the textures. The modular export
creates a hashed runtime PNG and preserves its exact embedded image bytes.
