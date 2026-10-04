export { PLACEHOLDER_FIGHTER, fighterHeight, type FighterBody, type FighterConfig, type FighterMotionParams } from './config';
export {
  NEUTRAL_INTENT,
  faceOpponent,
  initialMotionState,
  settleMotion,
  stepMotion,
  type FighterIntent,
  type MotionState,
  type MotionStep,
  type Posture,
  type Side,
} from './motion';
export { resolveSpacing, type SpacingBody, type SpacingRules } from './spacing';
export { IdleFighterController, KeyboardFighterController, type FighterController } from './controllers';
export { Fighter, type FighterOptions } from './Fighter';
