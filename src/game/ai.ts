import { WORLD, type AiProfile } from './config';
import { movePaddleToward, predictY } from './physics';
import type { Ball, Paddle } from './types';

/**
 * CPU opponent. It re-evaluates its target on a reaction timer (so it can be
 * fooled by late spin), aims with a per-rally random error, and optionally
 * predicts wall bounces.
 */
export class AiController {
  private target: number = WORLD.height / 2;
  private timer = 0;
  private aimError = 0;

  constructor(
    public profile: AiProfile,
    private readonly rng: () => number = Math.random,
  ) {}

  /** Call whenever the ball is hit or served so the AI picks a new mistake. */
  rerollError(): void {
    this.aimError = (this.rng() * 2 - 1) * this.profile.error;
  }

  update(paddle: Paddle, ball: Ball, dt: number): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.profile.reaction;
      this.target = this.computeTarget(paddle, ball);
    }
    // A small dead-zone avoids jitter when the paddle is already lined up.
    const target = Math.abs(this.target - paddle.y) < 4 ? paddle.y : this.target;
    movePaddleToward(paddle, target, this.profile.maxSpeed, dt);
  }

  private computeTarget(paddle: Paddle, ball: Ball): number {
    const incoming = paddle.side === 'right' ? ball.vx > 0 : ball.vx < 0;
    if (!incoming) {
      // Drift back toward the middle while the ball is going away.
      return WORLD.height / 2 + (ball.y - WORLD.height / 2) * 0.25;
    }
    const contactX = paddle.x + (paddle.side === 'right' ? -1 : 1) * (paddle.width / 2 + ball.radius);
    const predicted = this.profile.predict ? predictY(ball, contactX) : ball.y;
    return (predicted ?? ball.y) + this.aimError;
  }
}
