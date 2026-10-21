"""
Build VERA and REX: model, rig, animation clips, .blend source and game GLB.

Usage (from the repository root):
    blender -b --factory-startup -P blender/scripts/build_characters.py -- [--only vera|rex] [--render]
or, with the `bpy` Python module installed:
    python blender/scripts/build_characters.py [--only vera|rex] [--render]

Writes (regenerated on every run — edit the scripts, not these outputs):
    blender/characters/<id>.blend      source scene (armature + mesh + actions)
    assets/characters/<id>.glb         game asset loaded by src/fighters/characters/models.ts
    docs/images/characters/<id>_turnaround.jpg, <id>_poses.jpg   preview renders (with --render)
Never touches blender/BRAIN_ROT_LEGENDS.blend.
"""

import os
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

import brl_anim  # noqa: E402
import brl_rig  # noqa: E402
import char_rex  # noqa: E402
import char_vera  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
CHARACTERS = {'vera': char_vera, 'rex': char_rex}

PREVIEW_POSES = [
    ('idle', 0), ('attack_light', None), ('attack_heavy', None), ('attack_kick', None),
    ('attack_special', None), ('guard_high', 0), ('crouch', 0), ('victory', 0),
]


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    only = argv[argv.index('--only') + 1] if '--only' in argv else None
    return only, '--render' in argv


def build(module, render):
    brl_rig.reset_scene()
    bones = brl_rig.humanoid_bones(shoulder_width=module.SHOULDER, hip_width=module.HIP)
    rig = brl_rig.build_armature(f'{module.NAME}_rig', bones)
    mesh = module.build_mesh(bones)
    brl_rig.bind(mesh, rig)
    actions = brl_anim.build_actions(rig, module.STYLE)
    rig['brl_character'] = module.ID
    rig['brl_timing'] = {k: list(v) for k, v in module.TIMING.items()}

    os.makedirs(os.path.join(ROOT, 'blender', 'characters'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'assets', 'characters'), exist_ok=True)
    glb = os.path.join(ROOT, 'assets', 'characters', f'{module.ID}.glb')
    rig.animation_data.action = actions['idle']
    brl_rig.export_glb(glb, [rig, mesh])
    print(f'[build] {module.NAME}: {len(mesh.data.polygons)} faces, {len(actions)} clips -> {glb}')

    if render:
        out_dir = os.path.join(ROOT, 'docs', 'images', 'characters')
        os.makedirs(out_dir, exist_ok=True)
        tmp = tempfile.mkdtemp(prefix=f'brl_{module.ID}_')
        cam, _ = brl_rig.setup_preview_stage()
        rig.animation_data.action = actions['idle']
        bpy.context.scene.frame_set(0)
        views = []
        for i, azimuth in enumerate((-60, -95, 0, 120)):
            path = os.path.join(tmp, f'view_{i}.png')
            brl_rig.render_view(path, cam, azimuth, size=(400, 640))
            views.append(path)
        brl_rig.contact_sheet(views, os.path.join(out_dir, f'{module.ID}_turnaround.jpg'), cols=4)
        poses = []
        for clip, frame in PREVIEW_POSES:
            action = actions[clip]
            if frame is None:
                frame = module.TIMING[clip.split('_', 1)[1]][0] + 1  # first active frame
            brl_rig.pose_at(rig, action, frame)
            path = os.path.join(tmp, f'pose_{clip}.png')
            brl_rig.render_view(path, cam, -88, distance=5.2, size=(360, 480))
            poses.append(path)
        brl_rig.contact_sheet(poses, os.path.join(out_dir, f'{module.ID}_poses.jpg'), cols=4)
        shutil.rmtree(tmp, ignore_errors=True)
        rig.animation_data.action = actions['idle']
        bpy.context.scene.frame_set(0)

    # The .blend keeps preview stage objects out: delete them before saving.
    for obj in list(bpy.context.scene.objects):
        if obj not in (rig, mesh):
            bpy.data.objects.remove(obj, do_unlink=True)
    blend = os.path.join(ROOT, 'blender', 'characters', f'{module.ID}.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    print(f'[build] saved {blend}')


def main():
    only, render = args()
    for key, module in CHARACTERS.items():
        if only and key != only:
            continue
        build(module, render)


main()
