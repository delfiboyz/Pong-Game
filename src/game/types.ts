export type Side = 'left' | 'right';

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
}

export interface Paddle {
  side: Side;
  /** Center position. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Vertical velocity of the last simulation step (units/s), used for spin. */
  vy: number;
  /** 0..1 flash amount after a hit, for rendering. */
  flash: number;
}

export type PhysicsEvent =
  | { type: 'wall'; x: number; y: number }
  | { type: 'paddle'; side: Side; x: number; y: number; speed: number }
  | { type: 'goal'; scorer: Side };
