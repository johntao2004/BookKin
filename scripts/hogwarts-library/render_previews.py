"""Render saved actual geometry with Cycles; no generated/repainted imagery.

blender -b library-source.blend --python render_previews.py -- \
  --samples 256 --width 1440 --threads 8 ground-to-a ground-to-b gallery-diagonal

The verified system build lacks OpenImageDenoise. A tested bilateral compositor
blur was rejected because it softened thin details; deliver unfiltered renders.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import bpy

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'apps/web/public/assets/hogwarts-library'
parser = argparse.ArgumentParser()
parser.add_argument('--samples', type=int, default=256)
parser.add_argument('--width', type=int, default=1440)
parser.add_argument('--height', type=int)
parser.add_argument('--threads', type=int, default=min(8, os.cpu_count() or 2))
parser.add_argument('--output', type=Path, default=ASSETS)
parser.add_argument('cameras', nargs='*', default=['ground-to-a', 'ground-to-b', 'gallery-diagonal'])
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
args.output = args.output.resolve()
args.output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.use_denoising = False
scene.cycles.samples = args.samples
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = .025
scene.cycles.adaptive_min_samples = min(32, args.samples)
scene.render.threads_mode = 'FIXED'
scene.render.threads = args.threads
scene.render.resolution_x = args.width
scene.render.resolution_y = args.height or round(args.width * 9 / 16)
scene.render.resolution_percentage = 100
scene.use_nodes = False
source = Path(bpy.data.filepath)
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
entries = []
for name in args.cameras:
    if name not in bpy.data.objects:
        raise ValueError('Unknown saved camera: ' + name)
    scene.camera = bpy.data.objects[name]
    path = args.output / ('preview-' + name + '.png')
    scene.render.filepath = str(path)
    started = time.monotonic()
    bpy.ops.render.render(write_still=True)
    entry = {
        'file': str(path.relative_to(ROOT)), 'camera': name,
        'engine': 'Cycles CPU', 'threads': args.threads,
        'maximumSamples': args.samples, 'adaptiveThreshold': .025,
        'minimumSamples': min(32, args.samples),
        'resolution': [scene.render.resolution_x, scene.render.resolution_y],
        'denoising': False, 'renderCompositor': None,
        'elapsedSeconds': round(time.monotonic() - started, 2),
        'sourceBlendSha256': source_hash,
        'imageSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'cameraLensMm': scene.camera.data.lens,
        'exposure': scene.view_settings.exposure,
        'viewTransform': scene.view_settings.view_transform,
        'look': scene.view_settings.look,
    }
    entries.append(entry)
    (args.output / 'render-report.json').write_text(json.dumps(entries, indent=2))
    if args.output == ASSETS.resolve():
        report = json.loads((ASSETS / 'build-report.json').read_text())
        views = {view['camera']: view for view in report.get('actualRenders', [])}
        views[name] = entry
        report['actualRenders'] = list(views.values())
        (ASSETS / 'build-report.json').write_text(json.dumps(report, indent=2))
    print('RENDER_READY', json.dumps(entry), flush=True)
