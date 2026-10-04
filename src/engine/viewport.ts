export interface Viewport {
  width: number;
  height: number;
  aspect: number;
  pixelRatio: number;
}

/** Highest device pixel ratio we render at; higher values cost fill-rate for little gain. */
export const MAX_PIXEL_RATIO = 2;

/** Normalise raw element/device dimensions into a safe render viewport. */
export function resolveViewport(width: number, height: number, devicePixelRatio = 1): Viewport {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return { width: w, height: h, aspect: w / h, pixelRatio: Math.min(dpr, MAX_PIXEL_RATIO) };
}
