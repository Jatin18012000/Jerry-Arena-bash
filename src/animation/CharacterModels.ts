import { Color, Material, Mesh, type AnimationClip, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export interface LoadedCharacterModel {
  readonly scene: Object3D;
  readonly clips: readonly AnimationClip[];
}

/** One fighter's own copy of a model: independent skeleton and materials. */
export interface CharacterInstance {
  readonly root: Object3D;
  readonly clips: readonly AnimationClip[];
  readonly materials: readonly FlashableMaterial[];
}

/** A material plus its authored emissive, so hit flashes can be applied and undone. */
export interface FlashableMaterial {
  readonly material: Material & { emissive: Color; emissiveIntensity: number };
  readonly baseEmissive: Color;
  readonly baseIntensity: number;
}

/**
 * Parsed fighter GLBs, keyed by character id. `instantiate` clones the skinned scene (so a
 * mirror match gets two independent skeletons) and its materials (so flashing one fighter never
 * tints the other).
 */
export class CharacterModels {
  private readonly models: ReadonlyMap<string, LoadedCharacterModel>;

  constructor(models: ReadonlyMap<string, LoadedCharacterModel>) {
    this.models = models;
  }

  has(id: string): boolean {
    return this.models.has(id);
  }

  instantiate(id: string): CharacterInstance {
    const model = this.models.get(id);
    if (!model) throw new Error(`No model loaded for character "${id}"`);
    const root = cloneSkinned(model.scene);
    const materials: FlashableMaterial[] = [];
    root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.castShadow = true;
      // Skinned meshes animate outside their bind-pose bounds; never cull them.
      node.frustumCulled = false;
      const own = (m: Material) => {
        const copy = m.clone() as FlashableMaterial['material'];
        if (copy.emissive) materials.push({ material: copy, baseEmissive: copy.emissive.clone(), baseIntensity: copy.emissiveIntensity });
        return copy;
      };
      node.material = Array.isArray(node.material) ? node.material.map(own) : own(node.material);
    });
    return { root, clips: model.clips, materials };
  }

  dispose(): void {
    for (const model of this.models.values()) {
      model.scene.traverse((node) => {
        if (node instanceof Mesh) {
          node.geometry.dispose();
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          for (const m of mats) m.dispose();
        }
      });
    }
  }
}

/** Parse a GLB already in memory (tests, or a custom loader). */
export async function parseCharacterModel(data: ArrayBuffer): Promise<LoadedCharacterModel> {
  const gltf = await new GLTFLoader().parseAsync(data, '');
  return { scene: gltf.scene, clips: gltf.animations };
}

/** Load GLBs by URL (bundled assets, so this works offline). */
export async function loadCharacterModels(urls: Readonly<Record<string, string>>): Promise<CharacterModels> {
  const loader = new GLTFLoader();
  const entries = await Promise.all(
    Object.entries(urls).map(async ([id, url]) => {
      const gltf = await loader.loadAsync(url);
      return [id, { scene: gltf.scene, clips: gltf.animations }] as const;
    }),
  );
  return new CharacterModels(new Map(entries));
}
