import type RAPIER from '@dimforge/rapier3d-compat';

/** The initialised Rapier module (the `-compat` build embeds its WASM, so loading is offline). */
export type Rapier = typeof RAPIER;

let pending: Promise<Rapier> | null = null;

/**
 * Load and initialise Rapier once. The module is imported dynamically so its large
 * WASM payload lives in its own chunk and does not block the first paint.
 */
export function loadRapier(): Promise<Rapier> {
  pending ??= import('@dimforge/rapier3d-compat')
    .then(async ({ default: rapier }) => {
      await rapier.init();
      return rapier;
    })
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}
