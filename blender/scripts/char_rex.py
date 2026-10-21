"""
REX — power striker in a tech combat suit. Follows Reference Image B: black bodysuit with glowing
blue piping, short open jacket with a high blue-lined collar, grey armour plates (shoulders,
thighs, knees), black boots, fingerless gloves, black undercut hair, blue cheek marking and a
silver chest emblem.
"""

from brl_anim import legs
from brl_rig import PartBuilder, material, merge_pose

ID = 'rex'
NAME = 'REX'

# (startup, active, recovery) — must equal src/fighters/characters/rex.ts (checked by tests).
TIMING = {
    'light': (5, 3, 11),
    'heavy': (11, 4, 19),
    'kick': (9, 4, 16),
    'special': (15, 6, 24),
}

SHOULDER = 0.2
HIP = 0.105


def build_mesh(bones):
    skin = material('REX_skin', 0xe2b490, roughness=0.55)
    hair = material('REX_hair', 0x111116, roughness=0.45)
    shaved = material('REX_shaved', 0x3a3438, roughness=0.8)
    suit = material('REX_suit', 0x17191f, roughness=0.5)
    jacket = material('REX_jacket', 0x2a2e37, roughness=0.42, metallic=0.15)
    plate = material('REX_plate', 0x5a616b, roughness=0.4, metallic=0.5)
    piping = material('REX_piping', 0x2b8cff, roughness=0.3, emission=0x2b8cff, emission_strength=3.0)
    collar = material('REX_collar', 0x1f6fe0, roughness=0.45, emission=0x0d3a8a, emission_strength=0.6)
    emblem = material('REX_emblem', 0xc7ccd4, roughness=0.3, metallic=0.9)
    eye = material('REX_eye', 0x2a4a70, roughness=0.3)
    boot = material('REX_boot', 0x16171b, roughness=0.6)

    p = PartBuilder('REX')

    # Head and face
    p.blob('head', 'head', skin, (0.0, 0, 1.665), (0.104, 0.09, 0.12))
    p.blob('jaw', 'head', skin, (0.035, 0, 1.597), (0.068, 0.074, 0.052))
    for y in (1, -1):
        p.blob(f'eye_{y}', 'head', eye, (0.095, y * 0.037, 1.668), (0.01, 0.02, 0.009), segments=12, rings=8)
        p.box(f'brow_{y}', 'head', hair, (0.1, y * 0.038, 1.69), (0.012, 0.042, 0.009), rot=(y * -6, 0, 0), bevel=0.003)
        p.blob(f'ear_{y}', 'head', skin, (0.0, y * 0.09, 1.66), (0.018, 0.012, 0.03), segments=10, rings=6)
    p.blob('nose', 'head', skin, (0.104, 0, 1.645), (0.018, 0.012, 0.022), segments=10, rings=6)
    p.box('mouth', 'head', hair, (0.098, 0, 1.612), (0.004, 0.03, 0.004), bevel=0.0015)
    # Blue tech marking on the right cheek (the side the fight camera sees) — Reference B.
    p.box('cheek_mark', 'head', piping, (0.062, -0.077, 1.64), (0.012, 0.004, 0.034), rot=(0, 0, 30), bevel=0.0015)

    # Undercut: shaved sides, swept spiky top.
    p.blob('hair_sides', 'head', shaved, (-0.025, 0, 1.69), (0.104, 0.095, 0.098))
    p.blob('hair_top', 'head', hair, (-0.005, 0, 1.755), (0.105, 0.075, 0.055), rot=(0, 10, 0))
    for i, (x, y) in enumerate(((0.07, 0.0), (0.04, 0.035), (0.04, -0.035), (0.0, 0.0), (-0.04, 0.03), (-0.04, -0.03), (-0.08, 0.0))):
        p.cone(f'spike_{i}', 'head', hair, (x, y, 1.77), (x - 0.07, y * 1.4, 1.84 - abs(x) * 0.2), 0.03, segments=6)

    # Neck (suit), high open collar: dark outside, blue inside.
    p.loft('neck', 'neck', suit, (0, 0, 1.43), (0, 0, 1.575), [(0, 0.055, 0.06), (1, 0.05, 0.052)], segments=12)
    p.loft('collar_out', 'chest', jacket, (0, 0, 1.43), (0, 0, 1.6),
           [(0, 0.092, 0.11), (0.6, 0.092, 0.106), (1, 0.1, 0.118)], arc=(48, 312), segments=18)
    p.loft('collar_in', 'chest', collar, (0, 0, 1.435), (0, 0, 1.595),
           [(0, 0.084, 0.102), (0.6, 0.084, 0.098), (1, 0.092, 0.11)], arc=(48, 312), segments=18)

    # Torso: athletic suit, open jacket over it, piping and emblem.
    p.loft('chest', 'chest', suit, (0, 0, 1.25), (0, 0, 1.48),
           [(0, 0.1, 0.14), (0.45, 0.118, 0.168), (0.85, 0.1, 0.182), (1, 0.07, 0.1)])
    p.loft('jacket', 'chest', jacket, (0, 0, 1.24), (0, 0, 1.47),
           [(0, 0.118, 0.158), (0.45, 0.132, 0.182), (0.85, 0.114, 0.196), (1, 0.085, 0.13)],
           arc=(34, 326), segments=22)
    for y in (1, -1):
        p.loft(f'jacket_edge_{y}', 'chest', piping, (0.098, y * 0.07, 1.245), (0.07, y * 0.055, 1.462),
               [(0, 0.006, 0.006), (1, 0.006, 0.006)], segments=6)
        p.loft(f'chest_line_{y}', 'chest', piping, (0.104, y * 0.03, 1.26), (0.11, y * 0.045, 1.43),
               [(0, 0.005, 0.005), (1, 0.005, 0.005)], segments=6)
    p.blob('emblem', 'chest', emblem, (0.118, 0, 1.385), (0.01, 0.036, 0.036), segments=16, rings=8)
    p.loft('abdomen', 'spine', suit, (0, 0, 1.06), (0, 0, 1.29), [(0, 0.098, 0.135), (0.5, 0.092, 0.122), (1, 0.1, 0.138)])
    p.loft('pelvis', 'hips', suit, (0, 0, 0.86), (0, 0, 1.08), [(0, 0.1, 0.15), (0.6, 0.106, 0.152), (1, 0.098, 0.138)])
    p.loft('belt', 'hips', plate, (0, 0, 1.0), (0, 0, 1.035), [(0, 0.104, 0.148), (1, 0.104, 0.146)])

    for side, y in (('L', 1), ('R', -1)):
        # Legs
        p.loft(f'thigh_{side}', f'thigh.{side}', suit, (0, y * HIP, 0.98), (0, y * (HIP + 0.01), 0.52),
               [(0, 0.09, 0.09), (0.35, 0.088, 0.086), (1, 0.066, 0.064)], segments=14)
        p.box(f'thigh_plate_{side}', f'thigh.{side}', plate, (0.03, y * (HIP + 0.075), 0.76), (0.1, 0.03, 0.24),
              rot=(y * 6, 0, 0), bevel=0.012)
        p.loft(f'thigh_strap_{side}', f'thigh.{side}', boot, (0, y * HIP, 0.88), (0, y * HIP, 0.9),
               [(0, 0.09, 0.09), (1, 0.09, 0.09)], segments=14)
        p.loft(f'leg_line_{side}', f'thigh.{side}', piping, (0.08, y * (HIP + 0.02), 0.95), (0.06, y * (HIP + 0.02), 0.58),
               [(0, 0.005, 0.005), (1, 0.005, 0.005)], segments=6)
        p.loft(f'shin_{side}', f'shin.{side}', suit, (0, y * (HIP + 0.01), 0.55), (0, y * (HIP + 0.01), 0.18),
               [(0, 0.066, 0.064), (0.3, 0.07, 0.066), (1, 0.05, 0.05)], segments=14)
        p.blob(f'knee_pad_{side}', f'shin.{side}', plate, (0.05, y * (HIP + 0.01), 0.53), (0.04, 0.066, 0.075))
        p.loft(f'shin_line_{side}', f'shin.{side}', piping, (0.06, y * (HIP + 0.01), 0.46), (0.05, y * (HIP + 0.01), 0.22),
               [(0, 0.005, 0.005), (1, 0.005, 0.005)], segments=6)
        p.loft(f'boot_cuff_{side}', f'shin.{side}', boot, (0, y * (HIP + 0.01), 0.07), (0, y * (HIP + 0.01), 0.25),
               [(0, 0.07, 0.066), (1, 0.064, 0.06)], segments=14)
        p.box(f'boot_{side}', f'foot.{side}', boot, (0.05, y * (HIP + 0.01), 0.055), (0.26, 0.105, 0.11), bevel=0.03, smooth=True)
        p.box(f'boot_strap_{side}', f'foot.{side}', plate, (0.07, y * (HIP + 0.01), 0.095), (0.06, 0.11, 0.02), bevel=0.006)
        p.box(f'sole_{side}', f'foot.{side}', plate, (0.05, y * (HIP + 0.01), 0.008), (0.27, 0.11, 0.018), bevel=0.006)

        # Arms
        sx = y * SHOULDER
        p.loft(f'sleeve_{side}', f'upperarm.{side}', jacket, (0, sx, 1.44), (0, y * (SHOULDER + 0.03), 1.15),
               [(0, 0.058, 0.058), (0.5, 0.052, 0.054), (1, 0.046, 0.046)], segments=12)
        p.box(f'shoulder_pad_{side}', f'upperarm.{side}', plate, (0, y * (SHOULDER + 0.025), 1.405), (0.12, 0.07, 0.085),
              rot=(y * 24, 0, 0), bevel=0.02, smooth=True)
        p.box(f'pad_line_{side}', f'upperarm.{side}', piping, (0.0, y * (SHOULDER + 0.062), 1.39), (0.08, 0.006, 0.01),
              rot=(y * 24, 0, 0), bevel=0.002)
        p.loft(f'forearm_{side}', f'forearm.{side}', suit, (0, y * (SHOULDER + 0.03), 1.16), (0, y * (SHOULDER + 0.04), 0.93),
               [(0, 0.044, 0.044), (0.35, 0.046, 0.044), (1, 0.034, 0.034)], segments=12)
        p.loft(f'arm_line_{side}', f'forearm.{side}', piping, (0, y * (SHOULDER + 0.075), 1.14), (0, y * (SHOULDER + 0.072), 0.95),
               [(0, 0.005, 0.005), (1, 0.005, 0.005)], segments=6)
        p.box(f'fist_{side}', f'hand.{side}', boot, (0.008, y * (SHOULDER + 0.04), 0.862), (0.08, 0.064, 0.09), bevel=0.024, smooth=True)
        p.box(f'knuckle_plate_{side}', f'hand.{side}', plate, (0.048, y * (SHOULDER + 0.04), 0.862), (0.012, 0.066, 0.05), bevel=0.005)
        p.blob(f'fingers_{side}', f'hand.{side}', skin, (0.044, y * (SHOULDER + 0.04), 0.832), (0.014, 0.03, 0.012), segments=10, rings=6)

    return p.join('REX_body')


def _p(**kw):
    return {k.replace('_L', '.L').replace('_R', '.R'): v for k, v in kw.items()}


# Upright boxer's guard: fists high, heavier base than VERA.
STANCE = {
    'hips': (0, 0, -18), 'spine': (0, 8, 2), 'chest': (0, 4, 4), 'neck': (0, -2, 4), 'head': (0, -8, 8),
    **_p(upperarm_L=(16, -40, 0), forearm_L=(0, -122, 0), hand_L=(0, -6, 0),
         upperarm_R=(-16, -30, 0), forearm_R=(0, -132, 0), hand_R=(0, -6, 0)),
    **legs(-16, 22, 16, 20),
}
BOB = dict(STANCE, **legs(-18, 28, 18, 26), **_p(upperarm_L=(16, -42, 0), forearm_L=(0, -118, 0)))

GUARD_HIGH = merge_pose(STANCE, spine=(0, 14, 2), head=(0, 10, 4),
                        upperarm_L=(14, -58, 0), forearm_L=(0, -142, 0), upperarm_R=(-14, -56, 0), forearm_R=(0, -146, 0))
GUARD_LOW_ARMS = _p(upperarm_L=(14, -44, 0), forearm_L=(0, -128, 0), upperarm_R=(-14, -42, 0), forearm_R=(0, -132, 0))

ATTACKS = {
    # Lead jab.
    'light': {
        'windup': merge_pose(STANCE, upperarm_L=(12, -34, 0), forearm_L=(0, -128, 0)),
        'strike': merge_pose(STANCE, hips=(0, 0, -6), chest=(0, 4, -6), upperarm_L=(4, -88, 0), forearm_L=(0, -4, 0)),
    },
    # Dragon Hook: rear hook swinging round from the hip.
    'heavy': {
        'windup': merge_pose(STANCE, hips=(0, 0, -40), chest=(0, 6, -14), upperarm_R=(-30, -10, 0), forearm_R=(0, -110, 0)),
        'strike': merge_pose(STANCE, hips=(0, 0, 22), chest=(0, 6, 22), spine=(0, 10, 6),
                             upperarm_R=(-82, -24, 0), forearm_R=(0, -92, 0), hand_R=(0, 0, 0),
                             upperarm_L=(20, -30, 0), forearm_L=(0, -130, 0)),
    },
    # Shin Breaker: low stomping front kick with the lead leg.
    'kick': {
        'windup': {**STANCE, **_p(thigh_L=(0, -70, 0), shin_L=(0, 90, 0), foot_L=(0, -10, 0))},
        'strike': {**STANCE, 'spine': (0, -8, 2), 'chest': (0, -4, 4),
                   **_p(thigh_L=(0, -58, 0), shin_L=(0, 2, 0), foot_L=(0, 40, 0),
                        thigh_R=(0, 14, 0), shin_R=(0, 30, 0), foot_R=(0, -44, 0))},
    },
    # Overdrive Fist: coil, then a lunging rear straight.
    'special': {
        'windup': {**STANCE, 'hips': (0, 0, -42), 'spine': (0, 16, 0), 'chest': (0, 4, -12),
                   **_p(upperarm_R=(-20, 24, 0), forearm_R=(0, -128, 0), upperarm_L=(18, -60, 0), forearm_L=(0, -100, 0)),
                   **legs(-40, 70, -10, 60)},
        'strike': {**STANCE, 'hips': (0, 0, 30), 'spine': (0, 14, 6), 'chest': (0, 4, 14), 'hips_offset': (0.22, 0, 0),
                   **_p(upperarm_R=(-4, -88, 0), forearm_R=(0, -2, 0), upperarm_L=(30, -10, 0), forearm_L=(0, -100, 0)),
                   **legs(-50, 62, 34, 6)},
    },
}

# Rear fist straight up, lead fist raised beside the head: visible from either side of the stage.
VICTORY_A = merge_pose(STANCE, hips=(0, 0, -20), head=(0, -12, 18),
                       upperarm_R=(-20, -168, 0), forearm_R=(0, -10, 0), upperarm_L=(24, -140, 0), forearm_L=(0, -60, 0),
                       **{k.replace('.', '_'): v for k, v in legs(-8, 10, 10, 12).items()})
VICTORY_B = merge_pose(VICTORY_A, upperarm_R=(-18, -172, 0), forearm_R=(0, -24, 0), upperarm_L=(24, -146, 0), forearm_L=(0, -70, 0))

STYLE = {
    'stance': STANCE,
    'stance_bob': BOB,
    'guard_high': GUARD_HIGH,
    'guard_low_arms': GUARD_LOW_ARMS,
    'crouch_arms': _p(upperarm_L=(16, -44, 0), forearm_L=(0, -122, 0), upperarm_R=(-16, -36, 0), forearm_R=(0, -130, 0)),
    'timing': TIMING,
    'attacks': ATTACKS,
    'victory_keys': [(0, VICTORY_A), (30, VICTORY_B)],
}
