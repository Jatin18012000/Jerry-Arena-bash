import {
  BoxGeometry,
  GridHelper,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';
import type { EngineContext } from '../Engine';
import { InputAction } from '../input';
import type { GameState } from '../state';

export const FOUNDATION_TEST_STATE_ID = 'debug.foundation';

/**
 * Phase 1 runtime proof only: a floor, a grid and a placeholder cube that the
 * movement actions nudge. This is NOT an arena, fighter or combat system.
 */
export function createFoundationTestState(): GameState<EngineContext> {
  const root = new Group();
  root.name = 'debug.foundation';

  const floorGeometry = new PlaneGeometry(40, 40);
  const floorMaterial = new MeshStandardMaterial({ color: 0x1c1630, roughness: 0.9 });
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;

  const grid = new GridHelper(40, 40, 0x7a4cff, 0x2e2450);
  grid.position.y = 0.001;

  const cubeGeometry = new BoxGeometry(1, 1, 1);
  const cubeMaterial = new MeshStandardMaterial({ color: 0xff3d81, roughness: 0.4, metalness: 0.1 });
  const cube = new Mesh(cubeGeometry, cubeMaterial);
  cube.name = 'debug.foundation.cube';
  cube.position.y = 0.5;
  cube.castShadow = true;

  root.add(floor, grid, cube);

  const speed = 3;

  return {
    id: FOUNDATION_TEST_STATE_ID,
    enter({ scene }) {
      scene.add(root);
    },
    exit({ scene }) {
      scene.remove(root);
      floorGeometry.dispose();
      floorMaterial.dispose();
      cubeGeometry.dispose();
      cubeMaterial.dispose();
      grid.dispose();
    },
    update(dt, { input }) {
      cube.rotation.y += dt * 0.8;
      const dx = Number(input.isDown(InputAction.Right)) - Number(input.isDown(InputAction.Left));
      const dz = Number(input.isDown(InputAction.Down)) - Number(input.isDown(InputAction.Up));
      cube.position.x = Math.max(-8, Math.min(8, cube.position.x + dx * speed * dt));
      cube.position.z = Math.max(-8, Math.min(8, cube.position.z + dz * speed * dt));
    },
  };
}
