import type { Side } from '../fighters';
import type { HurtboxDefinition } from './config';
import type { HitboxDefinition } from './moves';
import type { Box } from './types';

/** Open-interval overlap: boxes that only touch do not overlap. */
export function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** World-space hitbox for a fighter whose feet are at (x, y), facing `facing`. */
export function hitboxWorld(def: HitboxDefinition, x: number, y: number, facing: Side): Box {
  const a = x + facing * def.near;
  const b = x + facing * def.far;
  return { x0: Math.min(a, b), x1: Math.max(a, b), y0: y + def.bottom, y1: y + def.top };
}

export function hurtboxWorld(def: HurtboxDefinition, x: number, y: number): Box {
  return { x0: x - def.halfWidth, x1: x + def.halfWidth, y0: y + def.bottom, y1: y + def.top };
}

/** Centre of the intersection of two overlapping boxes: where hit sparks appear. */
export function contactPoint(a: Box, b: Box): { x: number; y: number } {
  return {
    x: (Math.max(a.x0, b.x0) + Math.min(a.x1, b.x1)) / 2,
    y: (Math.max(a.y0, b.y0) + Math.min(a.y1, b.y1)) / 2,
  };
}
