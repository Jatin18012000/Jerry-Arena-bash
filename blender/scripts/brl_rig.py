"""
BRAIN ROT: LEGENDS — shared Blender toolkit for procedurally built fighters.

Conventions (match the game, see docs/DEVELOPMENT_WORKFLOW.md):
- 1 Blender unit = 1 metre. Character stands on Z = 0, centred on the origin.
- Character faces +X. Its left side is +Y. (glTF export converts Z-up to Y-up; +X stays +X.)
- Scene runs at 60 fps: one animation frame = one combat frame.
- Rigid skinning: every mesh part is weighted 100% to one bone. Robust, game-ready, no
  deformation artefacts — the "action figure" look suits the stylised art direction.

Pose angles are given in ARMATURE space, in degrees, as (rx, ry, rz):
- ry > 0 tips a bone that points UP towards +X (forward); a bone that points DOWN swings its tip
  backwards (-X). So: thigh raise / arm raise forward = negative ry; knee bend = positive ry on
  the shin; elbow bend (hand forward) = negative ry on the forearm; lean forward = positive ry on
  the spine.
- rx > 0 swings a downward bone's tip towards +Y (the character's left).
- rz > 0 turns +X towards +Y (twist to the character's left).
"""

import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

FPS = 60

# ---------------------------------------------------------------------------------------------
# Scene
# ---------------------------------------------------------------------------------------------


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.frame_start = 0
    scene.frame_end = 60
    return scene


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgba(hex_color):
    r, g, b = ((hex_color >> 16) & 255) / 255, ((hex_color >> 8) & 255) / 255, (hex_color & 255) / 255
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def material(name, hex_color, roughness=0.6, metallic=0.0, emission=None, emission_strength=0.0):
    """Plain Principled material (no textures, so the GLB parses anywhere, offline)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = hex_rgba(hex_color)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission is not None:
        bsdf.inputs['Emission Color'].default_value = hex_rgba(emission)
        bsdf.inputs['Emission Strength'].default_value = emission_strength
    mat.diffuse_color = hex_rgba(hex_color)
    return mat


# ---------------------------------------------------------------------------------------------
# Mesh parts (bmesh based: no operator context needed)
# ---------------------------------------------------------------------------------------------


def _resample(profile, per_span=3):
    """Catmull-Rom resample of a loft profile so few hand-written sections give smooth curves."""
    if len(profile) < 3:
        return profile
    pts = [(s[0], s[1], s[2], tuple(s[3]) if len(s) > 3 else (0.0, 0.0, 0.0)) for s in profile]
    out = []
    for i in range(len(pts) - 1):
        p_prev, p0, p1, p_next = pts[max(0, i - 1)], pts[i], pts[i + 1], pts[min(len(pts) - 1, i + 2)]
        for k in range(per_span):
            u = k / per_span
            u2, u3 = u * u, u * u * u

            def cr(a, b, c, d):
                return 0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3)

            t = p0[0] + (p1[0] - p0[0]) * u
            rf = max(1e-4, cr(p_prev[1], p0[1], p1[1], p_next[1]))
            rs = max(1e-4, cr(p_prev[2], p0[2], p1[2], p_next[2]))
            off = tuple(a + (b - a) * u for a, b in zip(p0[3], p1[3]))
            out.append((t, rf, rs, off))
    last = pts[-1]
    out.append((last[0], last[1], last[2], last[3]))
    return out


class PartBuilder:
    """Collects mesh parts, each bound to one bone and one material, then joins them."""

    def __init__(self, prefix):
        self.prefix = prefix
        self.parts = []

    def _object(self, name, bm, bone, mat, smooth):
        mesh = bpy.data.meshes.new(f'{self.prefix}_{name}')
        bm.normal_update()
        bm.to_mesh(mesh)
        bm.free()
        mesh.polygons.foreach_set('use_smooth', [smooth] * len(mesh.polygons))
        mesh.materials.append(mat)
        obj = bpy.data.objects.new(f'{self.prefix}_{name}', mesh)
        bpy.context.scene.collection.objects.link(obj)
        group = obj.vertex_groups.new(name=bone)
        group.add(list(range(len(mesh.vertices))), 1.0, 'REPLACE')
        self.parts.append(obj)
        return obj

    def blob(self, name, bone, mat, center, radii, rot=(0, 0, 0), segments=20, rings=12, smooth=True):
        """Ellipsoid."""
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0)
        m = (
            Matrix.Translation(Vector(center))
            @ Euler([math.radians(a) for a in rot], 'XYZ').to_matrix().to_4x4()
            @ Matrix.Diagonal((*radii, 1.0))
        )
        bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
        return self._object(name, bm, bone, mat, smooth)

    def box(self, name, bone, mat, center, size, rot=(0, 0, 0), bevel=0.015, smooth=False):
        """Rounded box. `size` is full extents."""
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
        if bevel > 0:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect='EDGES', profile=0.5)
        m = Matrix.Translation(Vector(center)) @ Euler([math.radians(a) for a in rot], 'XYZ').to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
        return self._object(name, bm, bone, mat, smooth)

    def cone(self, name, bone, mat, base, tip, radius, segments=8, smooth=False):
        base, tip = Vector(base), Vector(tip)
        axis = tip - base
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=0.0, depth=axis.length)
        rot = axis.normalized().to_track_quat('Z', 'X').to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=Matrix.Translation((base + tip) / 2) @ rot, verts=bm.verts)
        return self._object(name, bm, bone, mat, smooth)

    def torus(self, name, bone, mat, center, axis, major, minor, segments=20, sides=8, scale_minor=(1.0, 1.0)):
        """Ring around `axis` (e.g. a wrap around a wrist)."""
        center, axis = Vector(center), Vector(axis).normalized()
        u = axis.orthogonal().normalized()
        v = axis.cross(u)
        bm = bmesh.new()
        rings = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            radial = u * math.cos(a) + v * math.sin(a)
            ring = []
            for j in range(sides):
                b = 2 * math.pi * j / sides
                p = center + radial * (major + minor * scale_minor[0] * math.cos(b)) + axis * minor * scale_minor[1] * math.sin(b)
                ring.append(bm.verts.new(p))
            rings.append(ring)
        for i in range(segments):
            r0, r1 = rings[i], rings[(i + 1) % segments]
            for j in range(sides):
                bm.faces.new((r0[j], r1[j], r1[(j + 1) % sides], r0[(j + 1) % sides]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return self._object(name, bm, bone, mat, True)

    def loft(self, name, bone, mat, p0, p1, profile, segments=16, forward=(1, 0, 0), arc=None, caps=True, smooth=True):
        """
        Tube from p0 to p1. `profile` = [(t, r_forward, r_side), ...] with t in 0..1: elliptical
        cross-sections (r_forward along the projection of `forward`, r_side across). Optional
        (t, rf, rs, (dx, dy, dz)) offsets a section. `arc=(a0, a1)` in degrees builds an open shell
        (e.g. an open jacket) — angle 0 points `forward`, 90 points to the side `axis x forward`.
        """
        profile = _resample(profile)
        p0, p1 = Vector(p0), Vector(p1)
        axis = p1 - p0
        d = axis.normalized()
        f = Vector(forward)
        u = f - d * f.dot(d)
        if u.length < 1e-6:
            u = d.orthogonal()
        u.normalize()
        v = d.cross(u)
        bm = bmesh.new()
        rings = []
        closed = arc is None
        count = segments if closed else segments + 1
        for section in profile:
            t, rf, rs = section[0], section[1], section[2]
            offset = Vector(section[3]) if len(section) > 3 else Vector((0, 0, 0))
            c = p0 + axis * t + offset
            ring = []
            for k in range(count):
                if closed:
                    a = 2 * math.pi * k / segments
                else:
                    a = math.radians(arc[0] + (arc[1] - arc[0]) * k / segments)
                ring.append(bm.verts.new(c + u * math.cos(a) * rf + v * math.sin(a) * rs))
            rings.append((c, ring))
        for (_, r0), (_, r1) in zip(rings, rings[1:]):
            for k in range(count if closed else count - 1):
                k1 = (k + 1) % count
                bm.faces.new((r0[k], r0[k1], r1[k1], r1[k]))
        if closed and caps:
            for (c, ring), sign in ((rings[0], -1), (rings[-1], 1)):
                tip = bm.verts.new(c + d * sign * 0.25 * min(profile[0 if sign < 0 else -1][1:3]))
                for k in range(count):
                    a, b = ring[k], ring[(k + 1) % count]
                    bm.faces.new((a, b, tip) if sign > 0 else (b, a, tip))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        if not closed:
            # Open shells are seen from both sides.
            mat.use_backface_culling = False
        return self._object(name, bm, bone, mat, smooth)

    def join(self, name):
        target = self.parts[0]
        with bpy.context.temp_override(
            active_object=target, object=target, selected_objects=self.parts, selected_editable_objects=self.parts
        ):
            bpy.ops.object.join()
        target.name = name
        target.data.name = name
        return target


# ---------------------------------------------------------------------------------------------
# Skeleton
# ---------------------------------------------------------------------------------------------

# name: (head, tail, parent). Armature space, metres; the character faces +X, left is +Y.
def humanoid_bones(scale=1.0, shoulder_width=0.19, hip_width=0.10):
    s = scale
    sw, hw = shoulder_width, hip_width
    bones = {
        'root': ((0, 0, 0), (0, 0, 0.12), None),
        'hips': ((0, 0, 0.98), (0, 0, 1.10), 'root'),
        'spine': ((0, 0, 1.10), (0, 0, 1.27), 'hips'),
        'chest': ((0, 0, 1.27), (0, 0, 1.45), 'spine'),
        'neck': ((0, 0, 1.45), (0, 0, 1.55), 'chest'),
        'head': ((0, 0, 1.55), (0, 0, 1.78), 'neck'),
    }
    for side, y in (('L', 1), ('R', -1)):
        bones.update({
            f'upperarm.{side}': ((0, y * sw, 1.42), (0, y * (sw + 0.03), 1.15), 'chest'),
            f'forearm.{side}': ((0, y * (sw + 0.03), 1.15), (0, y * (sw + 0.04), 0.91), f'upperarm.{side}'),
            f'hand.{side}': ((0, y * (sw + 0.04), 0.91), (0, y * (sw + 0.04), 0.81), f'forearm.{side}'),
            f'thigh.{side}': ((0, y * hw, 0.96), (0, y * (hw + 0.01), 0.53), 'hips'),
            f'shin.{side}': ((0, y * (hw + 0.01), 0.53), (0, y * (hw + 0.01), 0.10), f'thigh.{side}'),
            f'foot.{side}': ((0, y * (hw + 0.01), 0.10), (0.16, y * (hw + 0.01), 0.03), f'shin.{side}'),
        })
    return {k: (tuple(c * s for c in h), tuple(c * s for c in t), p) for k, (h, t, p) in bones.items()}


BONE_ORDER = [
    'root', 'hips', 'spine', 'chest', 'neck', 'head',
    'upperarm.L', 'forearm.L', 'hand.L', 'upperarm.R', 'forearm.R', 'hand.R',
    'thigh.L', 'shin.L', 'foot.L', 'thigh.R', 'shin.R', 'foot.R',
]


def build_armature(name, bones):
    data = bpy.data.armatures.new(name)
    rig = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for bone_name in BONE_ORDER:
        head, tail, parent = bones[bone_name]
        eb = data.edit_bones.new(bone_name)
        eb.head, eb.tail = head, tail
        eb.roll = 0.0
        if parent:
            eb.parent = data.edit_bones[parent]
            eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return rig


def bind(mesh, rig):
    mesh.parent = rig
    modifier = mesh.modifiers.new('Armature', 'ARMATURE')
    modifier.object = rig


# ---------------------------------------------------------------------------------------------
# Poses and actions
# ---------------------------------------------------------------------------------------------


def _local_rotation(pose_bone, rx, ry, rz):
    rest = pose_bone.bone.matrix_local.to_3x3()
    world = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix()
    return (rest.inverted() @ world @ rest).to_quaternion()


FOOT_CLEARANCE = 0.025  # rest height of the toe tip: keeps soles on the floor


def _lowest_foot_z(rig):
    bpy.context.view_layer.update()
    zs = []
    for side in ('L', 'R'):
        pb = rig.pose.bones[f'foot.{side}']
        zs += [pb.head.z, pb.tail.z]
        shin = rig.pose.bones[f'shin.{side}']
        zs.append(shin.tail.z - 0.06)  # heel sits a little below the ankle joint
    return min(zs)


def apply_pose(rig, pose):
    """
    `pose` = {bone: (rx, ry, rz)} plus optional keys:
    - 'hips_offset': (dx, dy, dz) in armature space;
    - 'airborne': True to skip grounding. Otherwise the hips are raised / lowered so the lowest
      foot point rests on the floor (Z = FOOT_CLEARANCE), so grounded poses never float or sink.
    Bones not listed return to rest, so every key fully defines the pose.
    """
    for pb in rig.pose.bones:
        angles = pose.get(pb.name, (0, 0, 0))
        pb.rotation_quaternion = _local_rotation(pb, *angles)
        pb.location = (0, 0, 0)
    hips = rig.pose.bones['hips']
    to_local = hips.bone.matrix_local.to_3x3().inverted()
    offset = Vector(pose.get('hips_offset', (0, 0, 0)))
    hips.location = to_local @ offset
    if not pose.get('airborne'):
        offset.z += FOOT_CLEARANCE - _lowest_foot_z(rig)
        hips.location = to_local @ offset


def key_pose(rig, frame):
    for pb in rig.pose.bones:
        pb.keyframe_insert('rotation_quaternion', frame=frame)
        pb.keyframe_insert('location', frame=frame)


def blend_pose(a, b, t):
    """Linear mix of two pose dicts (angles and hips offset)."""
    out = {}
    for key in set(a) | set(b):
        if key == 'airborne':
            continue
        va = a.get(key, (0, 0, 0))
        vb = b.get(key, (0, 0, 0))
        out[key] = tuple(x + (y - x) * t for x, y in zip(va, vb))
    if a.get('airborne') and b.get('airborne'):
        out['airborne'] = True
    return out


def merge_pose(base, **overrides):
    out = dict(base)
    for key, value in overrides.items():
        out[key.replace('_L', '.L').replace('_R', '.R')] = value
    return out


def make_action(rig, name, frames, keys, loop=False):
    """
    Create action `name` spanning frames 0..frames (duration = frames / 60 s in the GLB).
    `keys` = [(frame, pose), ...]. Loops end on their first pose.
    """
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = action
    keys = sorted(keys, key=lambda k: k[0])
    if loop and keys[-1][0] != frames:
        keys.append((frames, keys[0][1]))
    for frame, pose in keys:
        apply_pose(rig, pose)
        key_pose(rig, frame)
    action.use_frame_range = True
    action.frame_start = 0
    action.frame_end = frames
    action['brl_loop'] = bool(loop)
    rig.animation_data.action = None
    return action


def attack_action(rig, name, startup, active, recovery, stance, windup, strike, follow=None):
    """
    Attack clip timed to frame data: move frame f (1-based) is clip frame f - 1.
    Windup peaks on the last startup frame, the strike pose holds through the active frames,
    then the fighter recovers to stance by the end of recovery.
    """
    total = startup + active + recovery
    first_active = startup  # clip frame of move frame startup + 1
    last_active = startup + active - 1
    keys = [
        (0, stance),
        (max(1, startup - 2), windup),
        (first_active, strike),
        (last_active, follow or strike),
        (last_active + max(2, recovery // 3), blend_pose(follow or strike, stance, 0.45)),
        (total, stance),
    ]
    return make_action(rig, name, total, keys)


def export_glb(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_force_sampling=True,
        export_skins=True,
        export_yup=True,
        export_apply=True,
        export_materials='EXPORT',
        export_extras=True,
    )


# ---------------------------------------------------------------------------------------------
# Preview renders (Cycles on the CPU: works headless)
# ---------------------------------------------------------------------------------------------


def setup_preview_stage(target_height=1.8):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = False
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('PreviewWorld')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = hex_rgba(0x2a2440)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
    scene.world = world

    floor_mesh = bpy.data.meshes.new('PreviewFloor')
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=6)
    bm.to_mesh(floor_mesh)
    bm.free()
    floor_mesh.materials.append(material('PreviewFloorMat', 0x1c1630, roughness=0.9))
    floor = bpy.data.objects.new('PreviewFloor', floor_mesh)
    scene.collection.objects.link(floor)

    key = bpy.data.lights.new('Key', 'AREA')
    key.energy = 900
    key.size = 3
    key_obj = bpy.data.objects.new('Key', key)
    key_obj.location = (3.0, -3.5, 4.0)
    key_obj.rotation_euler = (math.radians(50), 0, math.radians(40))
    scene.collection.objects.link(key_obj)
    rim = bpy.data.lights.new('Rim', 'AREA')
    rim.energy = 500
    rim.size = 2
    rim.color = (0.7, 0.5, 1.0)
    rim_obj = bpy.data.objects.new('Rim', rim)
    rim_obj.location = (-3.0, 3.0, 3.0)
    rim_obj.rotation_euler = (math.radians(-55), 0, math.radians(-135))
    scene.collection.objects.link(rim_obj)

    cam = bpy.data.cameras.new('PreviewCam')
    cam.lens = 50
    cam_obj = bpy.data.objects.new('PreviewCam', cam)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    return cam_obj, [floor, key_obj, rim_obj, cam_obj]


def render_view(path, cam_obj, azimuth_deg, distance=4.4, height=1.0, look_z=0.95, size=(480, 720)):
    scene = bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = size
    a = math.radians(azimuth_deg)
    cam_obj.location = (math.cos(a) * distance, math.sin(a) * distance, height)
    direction = Vector((0, 0, look_z)) - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def pose_at(rig, action, frame):
    rig.animation_data_create()
    rig.animation_data.action = action
    bpy.context.scene.frame_set(int(frame))


def contact_sheet(paths, out_path, cols=4, quality=86):
    """Stitch same-sized renders into one JPEG (Blender image API: no extra Python packages)."""
    import array

    images = [bpy.data.images.load(p) for p in paths]
    w, h = images[0].size
    rows = (len(images) + cols - 1) // cols
    pixels = array.array('f', [0.0]) * (cols * w * rows * h * 4)
    for i, img in enumerate(images):
        src = array.array('f', [0.0]) * (w * h * 4)
        img.pixels.foreach_get(src)
        cx, cy = i % cols, rows - 1 - i // cols
        for y in range(h):
            d = ((cy * h + y) * cols * w + cx * w) * 4
            pixels[d:d + w * 4] = src[y * w * 4:(y + 1) * w * 4]
    sheet = bpy.data.images.new('contact_sheet', cols * w, rows * h)
    sheet.pixels.foreach_set(pixels)
    scene = bpy.context.scene
    settings = scene.render.image_settings
    previous = settings.file_format
    settings.file_format = 'JPEG'
    settings.quality = quality
    sheet.save_render(out_path, scene=scene)
    settings.file_format = previous  # later renders must still write PNG
    for img in images:
        bpy.data.images.remove(img)
    bpy.data.images.remove(sheet)
