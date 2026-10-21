import { existsSync, readFileSync, statSync } from 'node:fs';
import { Box3, Quaternion, SkinnedMesh, type Bone } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { CharacterModels, Clip, FighterAnimator, REQUIRED_CLIPS, attackClip, parseCharacterModel, selectPose, type LoadedCharacterModel } from '../src/animation';
import { createCombatState, startAttack, totalFrames } from '../src/combat';
import { initialMotionState } from '../src/fighters';
import { ROSTER } from '../src/fighters/characters';

/** Blender bone names; Three's glTF loader strips the dots (foot.L → footL) when it loads them. */
const BLENDER_BONES = [
  'root', 'hips', 'spine', 'chest', 'neck', 'head',
  'upperarm.L', 'forearm.L', 'hand.L', 'upperarm.R', 'forearm.R', 'hand.R',
  'thigh.L', 'shin.L', 'foot.L', 'thigh.R', 'shin.R', 'foot.R',
];
const BONES = BLENDER_BONES.map((name) => name.replace('.', ''));

const loaded = new Map<string, LoadedCharacterModel>();
beforeAll(async () => {
  for (const c of ROSTER) {
    const buf = readFileSync(`assets/characters/${c.id}.glb`);
    loaded.set(c.id, await parseCharacterModel(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
  }
});

const skinnedMeshes = (model: LoadedCharacterModel): SkinnedMesh[] => {
  const out: SkinnedMesh[] = [];
  model.scene.traverse((o) => {
    if (o instanceof SkinnedMesh) out.push(o);
  });
  return out;
};

describe.each(ROSTER.map((c) => [c.id, c] as const))('%s GLB asset', (id, character) => {
  it('exists next to its Blender source and stays within budget', () => {
    expect(existsSync(`blender/characters/${id}.blend`)).toBe(true);
    expect(statSync(`assets/characters/${id}.glb`).size).toBeLessThan(2 * 1024 * 1024);
    const triangles = skinnedMeshes(loaded.get(id)!).reduce((n, m) => n + (m.geometry.index?.count ?? 0) / 3, 0);
    expect(triangles).toBeGreaterThan(2000);
    expect(triangles).toBeLessThan(20000);
  });

  it('is a skinned mesh on the shared 18-bone humanoid rig', () => {
    const meshes = skinnedMeshes(loaded.get(id)!);
    expect(meshes.length).toBeGreaterThan(0);
    const names = meshes[0]!.skeleton.bones.map((b: Bone) => b.name).sort();
    expect(names).toEqual([...BONES].sort());
    for (const m of meshes) expect(m.skeleton.bones).toHaveLength(BONES.length);
  });

  it('stands on the floor, about 1.8 m tall, facing +X', () => {
    const box = new Box3().setFromObject(loaded.get(id)!.scene);
    expect(box.min.y).toBeGreaterThan(-0.02);
    expect(box.min.y).toBeLessThan(0.03);
    expect(box.max.y).toBeGreaterThan(1.7);
    expect(box.max.y).toBeLessThan(1.95);
    expect(box.max.x).toBeGreaterThan(-box.min.x); // toes and face point +X
  });

  it('has every clip the game needs', () => {
    const names = loaded.get(id)!.clips.map((c) => c.name);
    for (const clip of REQUIRED_CLIPS) expect(names, clip).toContain(clip);
  });

  it('attack clips last exactly startup + active + recovery frames at 60 fps', () => {
    for (const move of Object.values(character.moves)) {
      const clip = loaded.get(id)!.clips.find((c) => c.name === attackClip(move.button))!;
      expect(clip.duration, move.name).toBeCloseTo(totalFrames(move) / 60, 6);
    }
  });

  it('animates: an attack frame moves the arm or leg away from the stance', () => {
    const models = new CharacterModels(new Map([[id, loaded.get(id)!]]));
    const instance = models.instantiate(id);
    const animator = new FighterAnimator(instance.root, instance.clips);
    const motion = initialMotionState(1);
    const neutral = createCombatState(1000);
    animator.apply(selectPose(neutral, motion, { stepsPerSecond: 60 }), 1 / 60);
    const bone = (name: string) => {
      let found: Bone | undefined;
      instance.root.traverse((o) => {
        if ((o as Bone).isBone && o.name === name) found = o as Bone;
      });
      return found!;
    };
    const watched = ['upperarmL', 'upperarmR', 'thighL', 'thighR'];
    const before = watched.map((n) => bone(n).quaternion.clone());
    const attacking = createCombatState(1000);
    startAttack(attacking, character.moves.special);
    attacking.frame = character.moves.special.startupFrames + 1;
    for (let i = 0; i < 12; i++) animator.apply(selectPose(attacking, motion, { stepsPerSecond: 60 }), 1 / 60); // finish the cross-fade
    const moved = watched.some((n, i) => bone(n).quaternion.angleTo(before[i]!) > 0.3);
    expect(moved).toBe(true);
    animator.dispose();
  });
});

describe('model instances', () => {
  it('a mirror match gets independent skeletons and materials', () => {
    const models = new CharacterModels(loaded);
    const a = models.instantiate('vera');
    const b = models.instantiate('vera');
    expect(a.root).not.toBe(b.root);
    expect(a.materials.length).toBeGreaterThan(0);
    expect(a.materials[0]!.material).not.toBe(b.materials[0]!.material);
    const boneA = skinnedMeshes({ scene: a.root, clips: [] })[0]!.skeleton.bones[0]!;
    const boneB = skinnedMeshes({ scene: b.root, clips: [] })[0]!.skeleton.bones[0]!;
    expect(boneA).not.toBe(boneB);
    expect(() => models.instantiate('titan')).toThrow(/No model/);
  });

  it('pinned poses are deterministic regardless of what played before', () => {
    const models = new CharacterModels(loaded);
    const pose = (history: readonly string[]) => {
      const inst = models.instantiate('rex');
      const animator = new FighterAnimator(inst.root, inst.clips);
      const motion = initialMotionState(1);
      for (const clip of history) {
        for (let i = 0; i < 10; i++) animator.apply({ clip: clip as never, mode: 'loop', fade: 0.1 }, 1 / 60);
      }
      const s = createCombatState(1000);
      startAttack(s, ROSTER[1]!.moves.heavy);
      s.frame = 12;
      for (let i = 0; i < 30; i++) animator.apply(selectPose(s, motion, { stepsPerSecond: 60 }), 1 / 60);
      const q: Quaternion[] = [];
      inst.root.traverse((o) => {
        if ((o as Bone).isBone) q.push((o as Bone).quaternion.clone());
      });
      animator.dispose();
      return q.map((x) => x.toArray().map((v) => Number(v.toFixed(6))));
    };
    expect(pose([Clip.Idle])).toEqual(pose([Clip.WalkForward, Clip.Crouch, Clip.GuardHigh]));
  });

  it('the animator refuses a model without the required clips', () => {
    const vera = loaded.get('vera')!;
    expect(() => new FighterAnimator(vera.scene, vera.clips.filter((c) => c.name !== 'getup'))).toThrow(/missing animation clips: getup/);
  });
});
