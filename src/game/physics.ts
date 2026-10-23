import { BALL, WORLD } from './config';
import type { Ball, Paddle, PhysicsEvent, Side } from './types';

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export function createBall(): Ball {
  return {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    vx: 0,
    vy: 0,
    radius: BALL.radius,
    speed: 0,
  };
}

/** Launch the ball from the center toward `toward`, with a random shallow angle. */
export function serveBall(ball: Ball, toward: Side, rng: () => number = Math.random): void {
  const angle = (rng() - 0.5) * (Math.PI / 3);
  const dir = toward === 'right' ? 1 : -1;
  ball.x = WORLD.width / 2;
  ball.y = WORLD.height / 2 + (rng() - 0.5) * WORLD.height * 0.4;
  ball.speed = BALL.startSpeed;
  ball.vx = dir * ball.speed * Math.cos(angle);
  ball.vy = ball.speed * Math.sin(angle);
}

/**
 * Advance the ball by `dt` seconds, resolving wall and paddle collisions.
 * Uses sub-stepping so a fast ball can never tunnel through a paddle.
 */
export function stepBall(ball: Ball, paddles: readonly Paddle[], dt: number): PhysicsEvent[] {
  const events: PhysicsEvent[] = [];
  const distance = Math.hypot(ball.vx, ball.vy) * dt;
  const steps = Math.max(1, Math.ceil(distance / (ball.radius * 0.5)));
  const h = dt / steps;

  for (let i = 0; i < steps; i++) {
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;

    if (ball.y - ball.radius < 0 && ball.vy < 0) {
      ball.y = ball.radius;
      ball.vy = -ball.vy;
      events.push({ type: 'wall', x: ball.x, y: 0 });
    } else if (ball.y + ball.radius > WORLD.height && ball.vy > 0) {
      ball.y = WORLD.height - ball.radius;
      ball.vy = -ball.vy;
      events.push({ type: 'wall', x: ball.x, y: WORLD.height });
    }

    for (const paddle of paddles) {
      if (collideWithPaddle(ball, paddle)) {
        events.push({ type: 'paddle', side: paddle.side, x: ball.x, y: ball.y, speed: ball.speed });
      }
    }

    if (ball.x + ball.radius < 0) {
      events.push({ type: 'goal', scorer: 'right' });
      break;
    }
    if (ball.x - ball.radius > WORLD.width) {
      events.push({ type: 'goal', scorer: 'left' });
      break;
    }
  }
  return events;
}

/** Circle-vs-rectangle test; on hit, reflects the ball with angle + spin. */
export function collideWithPaddle(ball: Ball, paddle: Paddle): boolean {
  const movingToward = paddle.side === 'left' ? ball.vx < 0 : ball.vx > 0;
  if (!movingToward) return false;

  const halfW = paddle.width / 2;
  const halfH = paddle.height / 2;
  const nearestX = clamp(ball.x, paddle.x - halfW, paddle.x + halfW);
  const nearestY = clamp(ball.y, paddle.y - halfH, paddle.y + halfH);
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  if (dx * dx + dy * dy > ball.radius * ball.radius) return false;

  // Where on the paddle did we hit? -1 (top) .. 1 (bottom)
  const offset = clamp((ball.y - paddle.y) / halfH, -1, 1);
  ball.speed = Math.min(BALL.maxSpeed, ball.speed + BALL.speedUpPerHit);

  const dir = paddle.side === 'left' ? 1 : -1;
  let angle = offset * BALL.maxBounceAngle;
  // Spin: a moving paddle bends the outgoing angle.
  angle += Math.atan2(paddle.vy * BALL.spinTransfer, ball.speed);
  angle = clamp(angle, -BALL.maxBounceAngle, BALL.maxBounceAngle);

  ball.vx = dir * ball.speed * Math.cos(angle);
  ball.vy = ball.speed * Math.sin(angle);
  ball.x = paddle.x + dir * (halfW + ball.radius);
  paddle.flash = 1;
  return true;
}

/**
 * Predict the y coordinate where the ball will cross `targetX`, accounting for
 * any number of wall bounces. Returns null if the ball is moving away.
 */
export function predictY(ball: Ball, targetX: number): number | null {
  if (ball.vx === 0) return null;
  const t = (targetX - ball.x) / ball.vx;
  if (t < 0) return null;

  const min = ball.radius;
  const span = WORLD.height - 2 * ball.radius;
  const raw = ball.y + ball.vy * t - min;
  const period = 2 * span;
  let m = ((raw % period) + period) % period;
  if (m > span) m = period - m;
  return m + min;
}

/** Move a paddle toward `targetY` at no more than `maxSpeed`, keeping it on screen. */
export function movePaddleToward(paddle: Paddle, targetY: number, maxSpeed: number, dt: number): void {
  const prev = paddle.y;
  const delta = clamp(targetY - paddle.y, -maxSpeed * dt, maxSpeed * dt);
  paddle.y = clamp(paddle.y + delta, paddle.height / 2, WORLD.height - paddle.height / 2);
  paddle.vy = (paddle.y - prev) / dt;
}
