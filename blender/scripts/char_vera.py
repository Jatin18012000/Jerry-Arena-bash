"""
VERA — agile kickboxer. Original design inspired by Reference Image A (see
docs/CHARACTER_BIBLE.md for what was kept from the reference and what was deliberately changed:
the reference depicts an existing copyrighted character, so VERA keeps the archetype and palette
but not that character's signature identifiers).
"""

from brl_anim import legs
from brl_rig import PartBuilder, material, merge_pose

ID = 'vera'
NAME = 'VERA'

# (startup, active, recovery) — must equal src/fighters/characters/vera.ts (checked by tests).
TIMING = {
    'light': (4, 2, 10),
    'heavy': (9, 3, 17),
    'kick': (7, 4, 14),
    'special': (13, 5, 23),
}

SHOULDER = 0.18
HIP = 0.095


def build_mesh(bones):
    skin = material('VERA_skin', 0xd99a74, roughness=0.55)
    hair = material('VERA_hair', 0x16121d, roughness=0.45)
    accent = material('VERA_violet', 0xa33cff, roughness=0.4, emission=0x7a1fd6, emission_strength=0.25)
    vest = material('VERA_vest', 0xece8f2, roughness=0.6)
    top = material('VERA_top', 0x1b1722, roughness=0.55)
    pants = material('VERA_pants', 0x1e1b26, roughness=0.75)
    glove = material('VERA_glove', 0x141218, roughness=0.5)
    eye = material('VERA_eye', 0x3b1a5c, roughness=0.3)
    lip = material('VERA_lip', 0x8e3d52, roughness=0.5)

    p = PartBuilder('VERA')

    # Head and face (head bone: 1.55 → 1.78)
    p.blob('head', 'head', skin, (0.0, 0, 1.665), (0.1, 0.088, 0.118))
    p.blob('jaw', 'head', skin, (0.035, 0, 1.6), (0.06, 0.065, 0.05))
    for y in (1, -1):
        p.blob(f'eye_{y}', 'head', eye, (0.093, y * 0.036, 1.668), (0.012, 0.022, 0.01), rot=(y * 8, 0, 0), segments=12, rings=8)
        p.box(f'brow_{y}', 'head', hair, (0.098, y * 0.037, 1.692), (0.01, 0.038, 0.007), rot=(y * -14, 0, 0), bevel=0.003)
        p.blob(f'ear_{y}', 'head', skin, (0.0, y * 0.087, 1.66), (0.018, 0.012, 0.028), segments=10, rings=6)
    p.blob('nose', 'head', skin, (0.1, 0, 1.646), (0.016, 0.011, 0.02), segments=10, rings=6)
    p.blob('lips', 'head', lip, (0.088, 0, 1.612), (0.008, 0.022, 0.006), segments=10, rings=6)

    # Hair: cap, blunt bangs, two round buns with violet bands, violet side lock.
    p.blob('hair_cap', 'head', hair, (-0.022, 0, 1.7), (0.106, 0.097, 0.1))
    p.blob('bangs', 'head', hair, (0.078, 0, 1.728), (0.034, 0.094, 0.04), rot=(0, -18, 0))
    for y in (1, -1):
        p.blob(f'bun_{y}', 'head', hair, (-0.025, y * 0.075, 1.79), (0.05, 0.05, 0.05))
        p.torus(f'bun_band_{y}', 'head', accent, (-0.022, y * 0.065, 1.765), (0, y * 0.45, 1), 0.04, 0.011)
    p.loft('side_lock', 'head', accent, (0.04, 0.094, 1.73), (0.05, 0.1, 1.56),
           [(0, 0.012, 0.014), (0.6, 0.011, 0.012), (1, 0.004, 0.006)], segments=8)

    # Neck and choker
    p.loft('neck', 'neck', skin, (0, 0, 1.44), (0, 0, 1.57), [(0, 0.045, 0.05), (1, 0.04, 0.045)], segments=12)
    p.torus('choker', 'neck', accent, (0, 0, 1.495), (0, 0, 1), 0.044, 0.01, scale_minor=(1, 1.4))

    # Torso: black top over the chest, bare midriff, open white crop vest with violet trim.
    p.loft('top', 'chest', top, (0, 0, 1.25), (0, 0, 1.48),
           [(0, 0.09, 0.125), (0.4, 0.112, 0.14), (0.8, 0.09, 0.15), (1, 0.06, 0.08)])
    p.loft('vest', 'chest', vest, (0, 0, 1.27), (0, 0, 1.49),
           [(0, 0.106, 0.146), (0.4, 0.127, 0.16), (0.8, 0.106, 0.172), (1, 0.08, 0.13)],
           arc=(26, 334), segments=24)
    p.loft('vest_hem', 'chest', accent, (0, 0, 1.262), (0, 0, 1.29),
           [(0, 0.108, 0.148), (1, 0.111, 0.151)], arc=(26, 334), segments=24)
    for y in (1, -1):
        p.loft(f'vest_edge_{y}', 'chest', accent, (0.097, y * 0.066, 1.275), (0.072, y * 0.058, 1.47),
               [(0, 0.008, 0.008), (0.45, 0.01, 0.009), (1, 0.007, 0.007)], segments=6)
        p.blob(f'shoulder_{y}', 'chest', skin, (0, y * (SHOULDER - 0.005), 1.425), (0.052, 0.05, 0.05))
    p.loft('waist', 'spine', skin, (0, 0, 1.06), (0, 0, 1.29), [(0, 0.09, 0.125), (0.5, 0.078, 0.105), (1, 0.088, 0.118)])

    # Pants, belt and its trailing tail.
    p.loft('pelvis', 'hips', pants, (0, 0, 0.86), (0, 0, 1.08), [(0, 0.1, 0.15), (0.6, 0.11, 0.155), (1, 0.098, 0.135)])
    p.loft('belt', 'hips', pants, (0, 0, 1.035), (0, 0, 1.085), [(0, 0.104, 0.142), (1, 0.102, 0.138)])
    p.loft('belt_trim', 'hips', accent, (0, 0, 1.03), (0, 0, 1.042), [(0, 0.106, 0.145), (1, 0.106, 0.145)])
    p.loft('belt_tail', 'hips', pants, (0.08, 0.09, 1.04), (0.13, 0.15, 0.6),
           [(0, 0.012, 0.032), (0.5, 0.01, 0.03), (1, 0.008, 0.026)], segments=8, forward=(1, -1, 0))

    for side, y in (('L', 1), ('R', -1)):
        hx = y * HIP
        p.loft(f'thigh_{side}', f'thigh.{side}', pants, (0, hx, 0.98), (0, y * (HIP + 0.012), 0.52),
               [(0, 0.1, 0.1), (0.45, 0.128, 0.122), (1, 0.108, 0.104)])
        p.loft(f'thigh_trim_{side}', f'thigh.{side}', accent, (0, y * (HIP + 0.105), 0.92), (0, y * (HIP + 0.112), 0.56),
               [(0, 0.007, 0.006), (0.45, 0.009, 0.007), (1, 0.007, 0.006)], segments=6)
        p.loft(f'shin_{side}', f'shin.{side}', pants, (0, y * (HIP + 0.012), 0.55), (0, y * (HIP + 0.012), 0.12),
               [(0, 0.105, 0.1), (0.45, 0.13, 0.122), (0.82, 0.1, 0.095), (1, 0.05, 0.05)])
        p.loft(f'shin_trim_{side}', f'shin.{side}', accent, (0.0, y * (HIP + 0.125), 0.5), (0.0, y * (HIP + 0.1), 0.22),
               [(0, 0.007, 0.006), (0.5, 0.009, 0.007), (1, 0.006, 0.005)], segments=6)
        for i, z in enumerate((0.115, 0.145)):
            p.torus(f'ankle_wrap_{side}{i}', f'shin.{side}', accent, (0, y * (HIP + 0.012), z), (0, 0, 1), 0.044, 0.017)
        p.loft(f'foot_{side}', f'foot.{side}', skin, (-0.045, y * (HIP + 0.012), 0.045), (0.17, y * (HIP + 0.012), 0.03),
               [(0, 0.03, 0.035), (0.3, 0.035, 0.042), (0.85, 0.022, 0.045), (1, 0.012, 0.03)], forward=(0, 0, 1), segments=12)
        p.torus(f'foot_wrap_{side}', f'foot.{side}', glove, (0.03, y * (HIP + 0.012), 0.045), (1, 0, -0.3), 0.04, 0.012, scale_minor=(1, 1.8))

        sx = y * SHOULDER
        p.loft(f'upperarm_{side}', f'upperarm.{side}', skin, (0, sx, 1.43), (0, y * (SHOULDER + 0.03), 1.15),
               [(0, 0.044, 0.044), (0.4, 0.041, 0.043), (1, 0.035, 0.036)], segments=12)
        p.loft(f'forearm_{side}', f'forearm.{side}', skin, (0, y * (SHOULDER + 0.03), 1.16), (0, y * (SHOULDER + 0.04), 0.93),
               [(0, 0.035, 0.036), (0.35, 0.037, 0.036), (1, 0.027, 0.028)], segments=12)
        for i, z in enumerate((0.945, 0.975)):
            p.torus(f'wrist_wrap_{side}{i}', f'forearm.{side}', accent, (0, y * (SHOULDER + 0.04), z), (0, 0, 1), 0.035, 0.014)
        p.box(f'fist_{side}', f'hand.{side}', glove, (0.008, y * (SHOULDER + 0.04), 0.865), (0.075, 0.058, 0.085), bevel=0.022, smooth=True)
        p.box(f'knuckles_{side}', f'hand.{side}', accent, (0.045, y * (SHOULDER + 0.04), 0.86), (0.014, 0.06, 0.05), bevel=0.006, smooth=True)

    return p.join('VERA_body')


def _p(**kw):
    return {k.replace('_L', '.L').replace('_R', '.R'): v for k, v in kw.items()}


STANCE = {
    'hips': (0, 0, -22), 'spine': (0, 6, 4), 'chest': (0, 4, 6), 'neck': (0, -2, 6), 'head': (0, -6, 6),
    **_p(upperarm_L=(18, -52, 0), forearm_L=(0, -92, 0), hand_L=(0, -10, 0),
         upperarm_R=(-14, -32, 0), forearm_R=(0, -122, 0), hand_R=(0, -10, 0)),
    **legs(-20, 26, 18, 22),
}
BOB = dict(STANCE, **legs(-24, 34, 22, 30), **_p(upperarm_L=(18, -56, 0), forearm_L=(0, -88, 0)))

GUARD_HIGH = merge_pose(STANCE, spine=(0, 12, 4), head=(0, 6, 6),
                        upperarm_L=(22, -62, 0), forearm_L=(0, -138, 0), upperarm_R=(-22, -58, 0), forearm_R=(0, -142, 0))
GUARD_LOW_ARMS = _p(upperarm_L=(20, -50, 0), forearm_L=(0, -120, 0), upperarm_R=(-20, -46, 0), forearm_R=(0, -124, 0))

ATTACKS = {
    # Lead-hand snap jab.
    'light': {
        'windup': merge_pose(STANCE, upperarm_L=(14, -42, 0), forearm_L=(0, -112, 0)),
        'strike': merge_pose(STANCE, hips=(0, 0, -8), chest=(0, 4, -8), upperarm_L=(4, -86, 0), forearm_L=(0, -4, 0)),
    },
    # Rear knee driven up and forward.
    'heavy': {
        'windup': merge_pose(STANCE, hips=(0, 0, -30), **legs(-14, 22, 30, 40)),
        'strike': {**STANCE, 'hips': (0, 0, -12), 'spine': (0, 8, 0), 'chest': (0, 4, 4), 'head': (0, 4, 6), 'hips_offset': (0.08, 0, 0),
                   **_p(upperarm_L=(10, -48, 0), forearm_L=(0, -70, 0), upperarm_R=(-10, 8, 0), forearm_R=(0, -96, 0),
                        thigh_L=(0, 6, 0), shin_L=(0, 10, 0), foot_L=(0, -16, 0),
                        thigh_R=(0, -112, 0), shin_R=(0, 124, 0), foot_R=(0, -20, 0))},
    },
    # Low sweep: drop low and slide the lead leg out along the floor.
    'kick': {
        'windup': merge_pose(STANCE, spine=(0, 14, 0), **legs(-50, 95, -30, 95)),
        'strike': {**STANCE, 'hips': (0, 0, -10), 'spine': (0, 10, 0), 'chest': (0, 6, 0),
                   **_p(upperarm_L=(30, -30, 0), forearm_L=(0, -60, 0), upperarm_R=(-22, -20, 0), forearm_R=(0, -40, 0),
                        thigh_L=(0, -82, 0), shin_L=(0, 4, 0), foot_L=(0, 30, 0),
                        thigh_R=(0, -52, 0), shin_R=(0, 128, 0), foot_R=(0, -70, 0))},
    },
    # Violet Crescent: spin away, then a high rear-leg crescent kick.
    'special': {
        'windup': {**STANCE, 'hips': (0, 0, 40), 'spine': (8, 0, 10), 'head': (0, 0, -40),
                   **_p(upperarm_L=(40, -30, 0), forearm_L=(0, -90, 0), upperarm_R=(-40, -30, 0), forearm_R=(0, -90, 0),
                        thigh_R=(-30, -60, 0), shin_R=(0, 90, 0), foot_R=(0, -20, 0),
                        thigh_L=(0, -6, 0), shin_L=(0, 16, 0), foot_L=(0, -10, 0))},
        'strike': {**STANCE, 'hips': (0, 0, 84), 'spine': (24, 0, 0), 'chest': (10, 0, 0), 'head': (-14, 0, -70),
                   **_p(upperarm_L=(50, -10, 0), forearm_L=(0, -60, 0), upperarm_R=(-60, 0, 0), forearm_R=(0, -40, 0),
                        thigh_R=(-96, -6, 0), shin_R=(-4, 0, 0), foot_R=(0, 30, 0),
                        thigh_L=(0, -4, 0), shin_L=(0, 12, 0), foot_L=(0, -8, 0))},
    },
}

# Both fists thrown up in a V, so the pose reads from either side of the stage.
VICTORY_A = merge_pose(STANCE, hips=(0, 0, -30), head=(0, -14, 20),
                       upperarm_L=(34, -165, 0), forearm_L=(0, -18, 0), upperarm_R=(-34, -165, 0), forearm_R=(0, -18, 0),
                       **{k.replace('.', '_'): v for k, v in legs(-10, 14, 12, 16).items()})
VICTORY_B = merge_pose(VICTORY_A, upperarm_L=(28, -172, 0), forearm_L=(0, -34, 0), upperarm_R=(-28, -172, 0), forearm_R=(0, -34, 0), head=(0, -18, 24))

STYLE = {
    'stance': STANCE,
    'stance_bob': BOB,
    'guard_high': GUARD_HIGH,
    'guard_low_arms': GUARD_LOW_ARMS,
    'crouch_arms': _p(upperarm_L=(18, -50, 0), forearm_L=(0, -104, 0), upperarm_R=(-14, -36, 0), forearm_R=(0, -120, 0)),
    'timing': TIMING,
    'attacks': ATTACKS,
    'victory_keys': [(0, VICTORY_A), (30, VICTORY_B)],
}
