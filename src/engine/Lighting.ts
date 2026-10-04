import { AmbientLight, DirectionalLight, HemisphereLight, type Object3D } from 'three';

/**
 * Neutral default lighting rig used until per-arena lighting exists.
 * Returns the created lights so callers can remove or tune them.
 */
export function createDefaultLighting(parent: Object3D): Object3D[] {
  const hemi = new HemisphereLight(0xbfd4ff, 0x1a1024, 0.6);
  hemi.name = 'engine.light.hemisphere';

  const ambient = new AmbientLight(0xffffff, 0.15);
  ambient.name = 'engine.light.ambient';

  const key = new DirectionalLight(0xffffff, 2.2);
  key.name = 'engine.light.key';
  key.position.set(4, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.bias = -0.0005;

  const lights = [hemi, ambient, key];
  parent.add(...lights);
  return lights;
}
