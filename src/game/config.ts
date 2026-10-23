/** Logical world size. Everything simulates in these units and is scaled to the screen. */
export const WORLD = { width: 1280, height: 720 } as const;

/** Fixed simulation step (seconds). Rendering runs at display refresh rate. */
export const SIM_DT = 1 / 120;

export const PADDLE = {
  width: 18,
  height: 120,
  margin: 48,
  keyboardSpeed: 960,
  pointerSpeed: 3200,
} as const;

export const BALL = {
  radius: 11,
  startSpeed: 620,
  speedUpPerHit: 38,
  maxSpeed: 1650,
  /** Maximum bounce angle off a paddle, radians. */
  maxBounceAngle: (55 * Math.PI) / 180,
  /** How much paddle vertical velocity is transferred into the ball ("spin"). */
  spinTransfer: 0.22,
  serveDelay: 1.1,
  trailLength: 18,
} as const;

export const COLORS = {
  p1: '#22e4ff',
  p2: '#ff2fd6',
  ball: '#fff35c',
  wall: '#e6ecff',
  grid: 'rgba(120, 140, 255, 0.07)',
  bg: '#05050b',
} as const;

export type Difficulty = 'easy' | 'normal' | 'hard' | 'insane';
export type Mode = 'cpu' | 'pvp';

export interface AiProfile {
  maxSpeed: number;
  /** Seconds between re-evaluations of the target. */
  reaction: number;
  /** Max random aim error in world units. */
  error: number;
  /** Whether the AI predicts wall bounces or just follows the ball. */
  predict: boolean;
}

export const AI_PROFILES: Record<Difficulty, AiProfile> = {
  easy: { maxSpeed: 430, reaction: 0.22, error: 70, predict: false },
  normal: { maxSpeed: 620, reaction: 0.14, error: 42, predict: true },
  hard: { maxSpeed: 820, reaction: 0.08, error: 24, predict: true },
  insane: { maxSpeed: 1150, reaction: 0.03, error: 10, predict: true },
};

export const POINTS_TO_WIN_OPTIONS = [5, 7, 11] as const;
export type PointsToWin = (typeof POINTS_TO_WIN_OPTIONS)[number];
