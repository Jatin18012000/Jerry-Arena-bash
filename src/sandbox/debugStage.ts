import {
  BoxGeometry,
  GridHelper,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterialParameters,
} from 'three';
import { STAGE_HALF_WIDTH } from './SandboxSimulation';

/** Tracks Three.js resources created for a sandbox view so they can be freed in one call. */
export class ResourceTracker {
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];

  geometry<G extends BufferGeometry>(g: G): G {
    this.geometries.push(g);
    return g;
  }

  material<M extends Material>(m: M): M {
    this.materials.push(m);
    return m;
  }

  paint(color: number, extra: MeshStandardMaterialParameters = {}): MeshStandardMaterial {
    return this.material(new MeshStandardMaterial({ color, roughness: 0.6, ...extra }));
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
  }
}

/**
 * Visuals for the flat debug stage shared by the sandboxes: floor, grid and the two translucent
 * walls at ±STAGE_HALF_WIDTH. Not an arena.
 */
export function buildDebugStage(root: Group, resources: ResourceTracker): { dispose(): void } {
  const floor = new Mesh(
    resources.geometry(new PlaneGeometry(STAGE_HALF_WIDTH * 2 + 8, 12)),
    resources.paint(0x1c1630, { roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const grid = new GridHelper(STAGE_HALF_WIDTH * 2 + 8, STAGE_HALF_WIDTH * 2 + 8, 0x7a4cff, 0x2e2450);
  grid.position.y = 0.001;
  root.add(floor, grid);

  const wallGeometry = resources.geometry(new BoxGeometry(0.1, 4, 3));
  const wallMaterial = resources.paint(0x7a4cff, { transparent: true, opacity: 0.35, emissive: 0x2a1060 });
  for (const side of [-1, 1]) {
    const wall = new Mesh(wallGeometry, wallMaterial);
    wall.name = `sandbox.wall.${side < 0 ? 'left' : 'right'}`;
    wall.position.set(side * (STAGE_HALF_WIDTH + 0.05), 2, 0);
    root.add(wall);
  }
  return { dispose: () => grid.dispose() };
}
