import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from 'three';
import { LOOPING_CLIPS, REQUIRED_CLIPS, type ClipName } from './clips';
import type { PoseRequest } from './selectPose';

/**
 * Plays a fighter's GLB clips from `PoseRequest`s. Presentation only.
 *
 * Call `apply` once per fixed simulation step (dt = 1/60): loops advance by dt, while attack /
 * stun / get-up poses are pinned to the time the simulation dictates, so the pose shown for a
 * given combat frame is always the same. Cross-fades smooth every change of clip.
 */
export class FighterAnimator {
  readonly mixer: AnimationMixer;
  private readonly actions = new Map<ClipName, AnimationAction>();
  private current: AnimationAction | null = null;
  private currentClip: ClipName | null = null;

  constructor(root: Object3D, clips: readonly AnimationClip[]) {
    this.mixer = new AnimationMixer(root);
    for (const clip of clips) {
      const name = clip.name as ClipName;
      if (!REQUIRED_CLIPS.includes(name)) continue;
      const action = this.mixer.clipAction(clip);
      const loops = LOOPING_CLIPS.has(name);
      action.setLoop(loops ? LoopRepeat : LoopOnce, loops ? Infinity : 1);
      action.clampWhenFinished = true;
      this.actions.set(name, action);
    }
    const missing = REQUIRED_CLIPS.filter((name) => !this.actions.has(name));
    if (missing.length > 0) throw new Error(`Fighter model is missing animation clips: ${missing.join(', ')}`);
  }

  get clip(): ClipName | null {
    return this.currentClip;
  }

  apply(request: PoseRequest, dt: number): void {
    const action = this.actions.get(request.clip)!;
    if (request.clip !== this.currentClip) {
      action.reset();
      action.enabled = true;
      action.setEffectiveWeight(1);
      action.play();
      if (this.current) {
        this.current.fadeOut(request.fade);
        action.fadeIn(request.fade);
      }
      this.current = action;
      this.currentClip = request.clip;
    }

    const duration = action.getClip().duration;
    if (request.mode === 'frame' || request.mode === 'normalized') {
      action.paused = true;
      const time = request.mode === 'frame' ? request.time : request.progress * duration;
      action.time = Math.min(Math.max(0, time), duration);
    } else {
      action.paused = false;
    }
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
