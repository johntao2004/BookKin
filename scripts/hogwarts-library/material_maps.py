#!/usr/bin/env python3
"""Original deterministic, periodic PBR tiles for BookKin's library.

Uses only NumPy/Pillow and seeded mathematical fields: no scans, downloaded
textures, screenshots, protected assets, baked lighting or painted geometry.
PNG albedos contain sRGB display values; roughness and OpenGL normals are data.
Run from any directory: python scripts/hogwarts-library/material_maps.py
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'apps/web/public/assets/hogwarts-library/textures'
SEED = 20261007


def noise(rng, size, sigma_u, sigma_v):
    """Unit-variance toroidal Gaussian random field; sigmas in pixels."""
    signal = rng.standard_normal((size, size))
    u = np.fft.rfftfreq(size)[None, :]
    v = np.fft.fftfreq(size)[:, None]
    kernel = np.exp(-2 * np.pi ** 2 * ((sigma_u * u) ** 2 + (sigma_v * v) ** 2))
    field = np.fft.irfft2(np.fft.rfft2(signal) * kernel, s=signal.shape)
    return (field - field.mean()) / max(float(field.std()), 1e-12)


def warp_u(field, offset):
    """Bilinear horizontal periodic warp, retaining seamless tile topology."""
    size = field.shape[0]
    cols = np.arange(size)[None, :] + offset
    lo = np.floor(cols).astype(np.int32)
    blend = cols - lo
    rows = np.arange(size)[:, None]
    return (1 - blend) * field[rows, lo % size] + blend * field[rows, (lo + 1) % size]


def normal_map(height, target_rms, maximum_slope):
    """OpenGL (+Y) tangent normals; image rows run opposite texture +V.

    Central differences wrap across boundaries. The height is dimensionless
    microrelief, never a displacement instruction or baked architectural detail.
    """
    du = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * .5
    image_dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * .5
    scale = target_rms / max(float(np.sqrt(np.mean(du * du + image_dy * image_dy))), 1e-12)
    nx, ny = -du * scale, image_dy * scale
    slope = np.sqrt(nx * nx + ny * ny)
    bound = np.minimum(1., maximum_slope / np.maximum(slope, 1e-12))
    nx, ny = nx * bound, ny * bound
    norm = np.sqrt(1. + nx * nx + ny * ny)
    normal = np.stack((nx / norm, ny / norm, 1. / norm), axis=-1)
    return np.rint((normal * .5 + .5) * 255).clip(0, 255).astype(np.uint8)


def rgb_pixels(base_hex, value, chroma):
    base = np.array([int(base_hex[i:i+2], 16) for i in (0, 2, 4)])
    value = value - value.mean()
    # The RGB values are already encoded sRGB; do not apply a gamma operation.
    color = base + value[..., None] * np.array([1., .82, .65])
    color += chroma[..., None] * np.array([.7, -.12, -.35])
    return np.rint(color).clip(0, 255).astype(np.uint8)


def wood(kind, base, size=1024):
    rng = np.random.default_rng(SEED + (11 if kind == 'walnut' else 23))
    u = np.arange(size)[None, :] / size
    v = np.arange(size)[:, None] / size
    slow = noise(rng, size, 88, 126)
    warp = 10. * noise(rng, size, 80, 154) + 4. * np.sin(2 * np.pi * (2 * v + .07 * np.sin(2 * np.pi * u)))
    fiber = warp_u(noise(rng, size, 1.05, 40), warp)
    grain = warp_u(noise(rng, size, 5.8, 115), warp)
    broad = warp_u(noise(rng, size, 22, 176), warp)
    # Subdued irregular growth bands supplement, rather than replace, fibers.
    phase = 2 * np.pi * (8 * u + .014 * warp + .22 * noise(rng, size, 118, 210))
    growth = np.sin(phase) * (.35 + .12 * np.tanh(slow))
    pores = np.maximum(warp_u(noise(rng, size, .7, 9), warp) - 1.15, 0.)
    pores *= .42 + .58 / (1 + np.exp(-noise(rng, size, 9, 25)))
    worn = noise(rng, size, 7, 2)
    micro = noise(rng, size, .52, 1.6)
    value = 2.8 * grain + 1.7 * broad + 1.3 * slow + .9 * fiber + 1.3 * growth - 1.5 * pores + .18 * worn
    value = 13 * np.tanh(value / 13)
    albedo = rgb_pixels(base, value, .8 * noise(rng, size, 30, 76))
    rough = (.575 if kind == 'walnut' else .525) + .024 * slow + .018 * grain + .014 * fiber + .034 * pores + .009 * micro
    rough = np.clip(rough, .41, .72)
    height = .18 * grain + .095 * fiber + .04 * growth - .22 * pores + .024 * micro + .012 * worn
    return albedo, np.rint(rough * 255).astype(np.uint8), normal_map(height, .060, .23)


def slate(size=512):
    rng = np.random.default_rng(SEED + 37)
    broad = noise(rng, size, 27, 33)
    cleft = noise(rng, size, 7, 18)
    grit = noise(rng, size, .75, 1.)
    fine = noise(rng, size, 2.2, 2.8)
    # Intermittent hairline clefts, with no mortar lines or fake tile geometry.
    lines = np.exp(-np.square(noise(rng, size, 13, 35) * 9))
    lines *= np.clip(noise(rng, size, 19, 22) + .25, 0, 1)
    rough = np.clip(.715 + .035 * broad + .024 * cleft + .019 * fine + .012 * grit + .02 * lines, .54, .87)
    height = .19 * broad + .23 * cleft + .035 * fine + .010 * grit - .13 * lines
    return np.rint(rough * 255).astype(np.uint8), normal_map(height, .070, .26)


def metal(size=512):
    rng = np.random.default_rng(SEED + 53)
    tarnish = noise(rng, size, 17, 21)
    hammer = noise(rng, size, 4.4, 4.4)
    pitting = np.maximum(noise(rng, size, .72, .72) - 1.7, 0)
    rubbed = noise(rng, size, .65, 8.)
    fine = noise(rng, size, .45, .45)
    rough = np.clip(.49 + .06 * tarnish + .025 * hammer + .018 * rubbed + .04 * pitting, .30, .74)
    height = .075 * hammer - .10 * pitting + .015 * rubbed + .008 * fine
    return np.rint(rough * 255).astype(np.uint8), normal_map(height, .035, .15)


def write(name, data, color_space):
    path = OUT / name
    Image.fromarray(data).save(path, optimize=True)
    pixels = np.asarray(Image.open(path))
    # Round-trip verifies that Pillow did not reinterpret data values.
    assert np.array_equal(data, pixels)
    horizontal = np.abs(pixels[:, -1].astype(float) - pixels[:, 0].astype(float)).mean()
    vertical = np.abs(pixels[-1].astype(float) - pixels[0].astype(float)).mean()
    interior_u = np.abs(np.diff(pixels.astype(float), axis=1)).mean()
    interior_v = np.abs(np.diff(pixels.astype(float), axis=0)).mean()
    stats = {}
    if pixels.ndim == 3:
        stats['channelRanges'] = [[int(pixels[..., i].min()), int(pixels[..., i].max())] for i in range(3)]
    if name.endswith('-normal.png'):
        normals = pixels.astype(float) / 255 * 2 - 1
        normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
        angles = np.degrees(np.arccos(normals[..., 2]))
        stats['normalAngleDegrees'] = {'rms': round(float(np.sqrt(np.mean(angles ** 2))), 3), 'maximum': round(float(angles.max()), 3)}
    return {
        'file': name, 'dimensions': [int(pixels.shape[1]), int(pixels.shape[0])],
        'mode': 'RGB' if pixels.ndim == 3 else 'L', 'colorSpace': color_space,
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'mean': np.round(pixels.mean(axis=(0, 1)), 3).tolist(),
        'minimum': int(pixels.min()), 'maximum': int(pixels.max()),
        'wrapBoundaryMeanDifference': {'u': round(float(horizontal), 4), 'v': round(float(vertical), 4)},
        'wrapVsInteriorDifferenceRatio': {'u': round(float(horizontal / max(interior_u, 1e-12)), 3), 'v': round(float(vertical / max(interior_v, 1e-12)), 3)},
        **stats
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        'version': 2, 'seed': SEED,
        'provenance': 'Original offline procedural NumPy/Pillow fields by BookKin; no scans, external images, screenshot copying, game textures or logos.',
        'limitations': 'Stylized procedural microdetail; not scanned materials or measured PBR. Architecture, edge wear and joinery remain modeled geometry.',
        'tiling': 'Periodic random fields and wrapped central differences; repeat both U and V. Opposite edge texels are consecutive samples rather than duplicated borders.',
        'orientation': 'Wood fibers predominantly follow texture V; UV orientation must follow each timber member. Normal maps use OpenGL +Y and neutral [128,128,255].',
        'materials': {}, 'files': []
    }
    for kind, base in [('walnut', '4c3529'), ('oak', '715340')]:
        color, rough, normal = wood(kind, base)
        stem = f'r2-{kind}'
        for suffix, data, space in [('albedo', color, 'sRGB'), ('roughness', rough, 'Non-Color'), ('normal', normal, 'Non-Color')]:
            manifest['files'].append(write(f'{stem}-{suffix}.png', data, space))
        manifest['materials'][kind] = {
            'albedo': f'{stem}-albedo.png', 'roughness': f'{stem}-roughness.png', 'normal': f'{stem}-normal.png',
            'targetAlbedoSRGB': '#' + base, 'normalStrength': .65,
            'roughnessUsage': 'Connect directly to Principled Roughness; values already include the material baseline.',
            'metallic': 0,
        }
    for kind, generator, strength in [('slate', slate, .55), ('aged-metal', metal, .55)]:
        rough, normal = generator()
        stem = f'r2-{kind}'
        manifest['files'].append(write(f'{stem}-roughness.png', rough, 'Non-Color'))
        manifest['files'].append(write(f'{stem}-normal.png', normal, 'Non-Color'))
        manifest['materials'][kind] = {
            'roughness': f'{stem}-roughness.png', 'normal': f'{stem}-normal.png', 'normalStrength': strength,
            'albedo': None,
            'roughnessUsage': 'Connect directly to Principled Roughness; preserve material-specific base color and metallic value.'
        }
    # Tangent-normal plausibility, deterministic data and expected dark palette.
    for kind in ('walnut', 'oak', 'slate', 'aged-metal'):
        arr = np.asarray(Image.open(OUT / f'r2-{kind}-normal.png'))
        vec = arr.astype(float) / 255 * 2 - 1
        assert np.max(np.abs(np.linalg.norm(vec, axis=2) - 1)) < .007
        assert arr[:, :, 2].min() >= 250
    path = OUT / 'r2-material-maps.json'
    path.write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
