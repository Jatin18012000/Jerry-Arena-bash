/** Horizontal (X) footprint of a fighter for spacing purposes. `y` is the feet height. */
export interface SpacingBody {
  /** X at the start of this step, used to decide who caused a max-separation violation. */
  readonly previousX: number;
  readonly x: number;
  readonly y: number;
  readonly halfWidth: number;
  readonly height: number;
}

export interface SpacingRules {
  /** Lowest / highest X a fighter's centre may reach (stage walls minus body radius). */
  readonly minX: number;
  readonly maxX: number;
  /** Fighters may not be further apart than this (keeps both on screen). */
  readonly maxSeparation: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Resolve fighter-vs-fighter spacing for one step and return the corrected X of each.
 *
 * 1. Max separation: the fighter(s) moving away are pulled back, in proportion to how far
 *    each moved away, so walking backwards stops at the limit instead of dragging the opponent.
 * 2. Pushboxes: overlapping fighters are pushed apart equally; against a wall the free fighter
 *    absorbs the rest. Fighters that do not overlap vertically (one jumping over) are left alone.
 *
 * Pure and deterministic: ties (identical X) always push `a` left.
 */
export function resolveSpacing(a: SpacingBody, b: SpacingBody, rules: SpacingRules): [number, number] {
  let ax = clamp(a.x, rules.minX, rules.maxX);
  let bx = clamp(b.x, rules.minX, rules.maxX);
  const dir = bx >= ax ? 1 : -1; // +1 when b is to the right of a

  const excess = Math.abs(bx - ax) - rules.maxSeparation;
  if (excess > 0) {
    const awayA = Math.max(0, -(ax - a.previousX) * dir);
    const awayB = Math.max(0, (bx - b.previousX) * dir);
    const total = awayA + awayB;
    const shareA = total > 0 ? awayA / total : 0.5;
    ax += excess * shareA * dir;
    bx -= excess * (1 - shareA) * dir;
  }

  const verticalOverlap = a.y < b.y + b.height && b.y < a.y + a.height;
  const overlap = a.halfWidth + b.halfWidth - Math.abs(bx - ax);
  if (verticalOverlap && overlap > 0) {
    const pushDir = bx >= ax ? 1 : -1;
    ax -= (overlap / 2) * pushDir;
    bx += (overlap / 2) * pushDir;

    const clampedA = clamp(ax, rules.minX, rules.maxX);
    bx += clampedA - ax; // a hit the wall: b takes the remainder
    ax = clampedA;
    const clampedB = clamp(bx, rules.minX, rules.maxX);
    ax += clampedB - bx; // b hit the wall: a takes the remainder
    bx = clampedB;
    ax = clamp(ax, rules.minX, rules.maxX);
  }

  return [ax, bx];
}
