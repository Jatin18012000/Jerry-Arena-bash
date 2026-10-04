import { DirectionalLight, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { createDefaultLighting } from '../src/engine/Lighting';

describe('createDefaultLighting', () => {
  it('adds a shadow-casting key light plus fill lights to the parent', () => {
    const scene = new Scene();
    const lights = createDefaultLighting(scene);
    expect(lights).toHaveLength(3);
    expect(scene.children).toEqual(expect.arrayContaining(lights));
    const key = lights.find((l): l is DirectionalLight => l instanceof DirectionalLight);
    expect(key?.castShadow).toBe(true);
  });
});
