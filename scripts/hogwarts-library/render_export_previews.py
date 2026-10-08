"""Render ONLY the reimported runtime GLB with the saved camera/light rig.

blender -b library-source.blend --python render_previews.py -- \
  --samples 96 --width 1440 --threads 8 ground-to-a ground-to-b gallery-diagonal

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
from mathutils import Vector

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
glb_path=ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb'
glb_sha256=hashlib.sha256(glb_path.read_bytes()).hexdigest()
# Preserve cameras/lights only: every rendered mesh below comes from delivered GLB.
for ob in list(bpy.data.objects):
    if ob.type=='MESH':bpy.data.objects.remove(ob,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(glb_path))
imported_meshes=[ob for ob in bpy.data.objects if ob.type=='MESH']
assert imported_meshes
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
# Supplemental actual-gallery furniture viewpoint. Geometry still comes only
# from the reimported runtime GLB; this camera is recorded explicitly below.
if 'upper-alcove-furniture' not in bpy.data.objects:
    data=bpy.data.cameras.new('upper-alcove-furniture');data.lens=32;data.clip_start=.05;data.clip_end=250
    ob=bpy.data.objects.new('upper-alcove-furniture',data);scene.collection.objects.link(ob)
    pos=(9.85,7.8,4.05);target=(12.85,7.25,2.5)
    to_blender=lambda p:Vector((p[0],-p[2],p[1]))
    ob.location=to_blender(pos);ob.rotation_euler=(to_blender(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    ob['supplementalVerificationCamera']=True
# Widen only this verification camera to include the entire column and ground.
# This does not modify the saved source or the delivered geometry.
side_camera=bpy.data.objects.get('reference-side-straight')
if side_camera:
    side_camera.location=( -7.2, -2.5, 7.1 )
    side_target=Vector((9.3,-2.5,7.1))
    side_camera.rotation_euler=(side_target-side_camera.location).to_track_quat('-Z','Y').to_euler()
    side_camera.data.lens=22;side_camera['supplementalVerificationCamera']=True
report_path=args.output/'render-report.json'
entries=json.loads(report_path.read_text()) if report_path.exists() else []
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
        'cameraRigBlendSha256': source_hash,
        'sourceGlbSha256': glb_sha256,
        'renderedGeometrySource': 'Reimported final architecture.glb; all source authoring meshes removed',
        'reimportedMeshCount':len(imported_meshes),
        'imageSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'cameraLensMm': scene.camera.data.lens,
        'cameraPositionThreeJs':[scene.camera.location.x,scene.camera.location.z,-scene.camera.location.y],
        'cameraEulerBlenderRadians':list(scene.camera.rotation_euler),
        'supplementalVerificationCamera':bool(scene.camera.get('supplementalVerificationCamera',False)),
        'exposure': scene.view_settings.exposure,
        'viewTransform': scene.view_settings.view_transform,
        'look': scene.view_settings.look,
    }
    entries=[old for old in entries if old['camera']!=name]
    entries.append(entry)
    (args.output / 'render-report.json').write_text(json.dumps(entries, indent=2))
    if args.output == ASSETS.resolve():
        report = json.loads((ROOT / 'scripts/hogwarts-library/deliverables/build-report.json').read_text())
        views = {view['camera']: view for view in report.get('actualRenders', [])}
        views[name] = entry
        report['actualRenders'] = list(views.values())
        (ROOT / 'scripts/hogwarts-library/deliverables/build-report.json').write_text(json.dumps(report, indent=2))
    print('RENDER_READY', json.dumps(entry), flush=True)
