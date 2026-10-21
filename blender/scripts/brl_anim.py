"""
Shared animation set for BRAIN ROT: LEGENDS fighters. Characters pass a `style` dict with their
own stance, guard and attack poses; everything else (walks, crouch, jump, reactions, knockdown)
is derived here so both fighters expose the same clip names to the game.

Clip contract (the game's src/animation/clips.ts mirrors this list):
  loops:     idle, walk_forward, walk_back, crouch, guard_high, guard_low, victory
  one-shot:  jump, hit_high, hit_crouch, launched, knockdown, getup, ko,
             attack_light, attack_heavy, attack_kick, attack_special
Attack clips last exactly startup + active + recovery frames (60 fps), so the game can show
move frame f at clip time (f - 1) / 60.
"""

from brl_rig import attack_action, blend_pose, make_action, merge_pose

LOOPS = ('idle', 'walk_forward', 'walk_back', 'crouch', 'guard_high', 'guard_low', 'victory')
ONE_SHOTS = ('jump', 'hit_high', 'hit_crouch', 'launched', 'knockdown', 'getup', 'ko')
ATTACKS = ('light', 'heavy', 'kick', 'special')


def legs(lead_thigh, lead_shin, rear_thigh, rear_shin, lead_side='L'):
    """Leg angles (ry) with feet kept flat: foot = -(thigh + shin)."""
    rear_side = 'R' if lead_side == 'L' else 'L'
    return {
        f'thigh.{lead_side}': (0, lead_thigh, 0),
        f'shin.{lead_side}': (0, lead_shin, 0),
        f'foot.{lead_side}': (0, -(lead_thigh + lead_shin), 0),
        f'thigh.{rear_side}': (0, rear_thigh, 0),
        f'shin.{rear_side}': (0, rear_shin, 0),
        f'foot.{rear_side}': (0, -(rear_thigh + rear_shin), 0),
    }


def build_actions(rig, style):
    stance = style['stance']
    bob = style.get('stance_bob', stance)
    guard_high = style['guard_high']
    crouch = merge_pose(stance, **{
        'spine': (0, 18, 0),
        'chest': (0, 8, 0),
        **{k.replace('.', '_'): v for k, v in legs(-72, 118, -48, 112).items()},
    })
    crouch.update(style.get('crouch_arms', {}))
    guard_low = merge_pose(crouch, **{k.replace('.', '_'): v for k, v in style['guard_low_arms'].items()})

    actions = {}
    actions['idle'] = make_action(rig, 'idle', 60, [(0, stance), (30, bob)], loop=True)

    step_out = merge_pose(stance, **{k.replace('.', '_'): v for k, v in legs(-34, 26, 24, 26).items()})
    step_in = merge_pose(stance, **{k.replace('.', '_'): v for k, v in legs(-8, 30, 6, 34).items()})
    actions['walk_forward'] = make_action(rig, 'walk_forward', 30, [(0, stance), (8, step_out), (16, stance), (23, step_in)], loop=True)
    actions['walk_back'] = make_action(rig, 'walk_back', 36, [(0, stance), (9, step_in), (18, stance), (27, step_out)], loop=True)

    actions['crouch'] = make_action(rig, 'crouch', 40, [(0, crouch), (20, blend_pose(crouch, guard_low, 0.25))], loop=True)
    actions['guard_high'] = make_action(rig, 'guard_high', 40, [(0, guard_high), (20, merge_pose(guard_high, spine=(0, 15, 0)))], loop=True)
    actions['guard_low'] = make_action(rig, 'guard_low', 40, [(0, guard_low), (20, merge_pose(guard_low, spine=(0, 24, 0)))], loop=True)

    tuck = dict(stance, airborne=True)
    tuck.update(legs(-85, 115, -60, 105))
    tuck['spine'] = (0, 12, 0)
    air = dict(stance, airborne=True)
    air.update(legs(-25, 35, 15, 30))
    actions['jump'] = make_action(rig, 'jump', 40, [(0, air), (8, tuck), (30, tuck), (40, air)])

    recoil = merge_pose(stance, **{
        'spine': (0, -16, 0), 'chest': (0, -12, 0), 'head': (0, -24, 8), 'neck': (0, -6, 0),
        'upperarm_L': (30, 5, 0), 'forearm_L': (0, -40, 0), 'upperarm_R': (-30, 0, 0), 'forearm_R': (0, -50, 0),
        'hips_offset': (-0.05, 0, 0),
    })
    actions['hit_high'] = make_action(rig, 'hit_high', 20, [(0, stance), (3, recoil), (12, blend_pose(recoil, stance, 0.5)), (20, guard_high)])
    crouch_recoil = merge_pose(crouch, spine=(0, -4, 0), head=(0, -30, 0), chest=(0, -10, 0))
    actions['hit_crouch'] = make_action(rig, 'hit_crouch', 20, [(0, crouch), (3, crouch_recoil), (20, crouch)])

    lying = {
        'airborne': True,
        'hips': (0, -90, 0), 'hips_offset': (0, 0, -0.84),
        'spine': (0, -4, 0), 'chest': (0, 0, 0), 'head': (0, 12, 15),
        'upperarm.L': (65, 10, 0), 'forearm.L': (0, -25, 0), 'upperarm.R': (-60, 15, 0), 'forearm.R': (0, -30, 0),
        'thigh.L': (8, -12, 0), 'shin.L': (0, 25, 0), 'thigh.R': (-6, -4, 0), 'shin.R': (0, 6, 0),
        'foot.L': (0, -50, 0), 'foot.R': (0, -60, 0),
    }
    arch = dict(recoil, airborne=True)
    arch.update({'hips': (0, -45, 0), 'spine': (0, -18, 0), 'upperarm.L': (50, 30, 0), 'upperarm.R': (-50, 30, 0)})
    arch.update(legs(-30, 40, 10, 50))
    actions['launched'] = make_action(rig, 'launched', 30, [(0, dict(recoil, airborne=True)), (10, arch), (30, blend_pose(arch, lying, 0.7))])
    actions['knockdown'] = make_action(rig, 'knockdown', 20, [(0, lying), (20, merge_pose(lying, head=(0, 6, 15)))])
    sitting = {
        'airborne': True, 'hips': (0, -25, 0), 'hips_offset': (-0.05, 0, -0.62),
        'spine': (0, 20, 0), 'head': (0, 0, 10),
        'upperarm.L': (25, 30, 0), 'forearm.L': (0, -20, 0), 'upperarm.R': (-25, 30, 0), 'forearm.R': (0, -20, 0),
        **legs(-75, 120, -60, 125),
    }
    actions['getup'] = make_action(rig, 'getup', 24, [(0, lying), (9, sitting), (17, crouch), (24, stance)])
    ko = merge_pose(lying, head=(0, 20, 35), upperarm_L=(80, 20, 0), upperarm_R=(-75, 25, 0))
    ko['airborne'] = True
    actions['ko'] = make_action(rig, 'ko', 20, [(0, ko), (20, ko)])

    actions['victory'] = make_action(rig, 'victory', 60, style['victory_keys'], loop=True)

    for name in ATTACKS:
        startup, active, recovery = style['timing'][name]
        poses = style['attacks'][name]
        actions[f'attack_{name}'] = attack_action(
            rig, f'attack_{name}', startup, active, recovery, stance,
            poses['windup'], poses['strike'], poses.get('follow'),
        )
    return actions
