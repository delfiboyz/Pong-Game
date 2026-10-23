import { describe, expect, it } from 'vitest';
import { BALL, PADDLE, WORLD } from './config';
import { collideWithPaddle, createBall, movePaddleToward, predictY, serveBall, stepBall } from './physics';
import type { Paddle } from './types';

const paddle = (side: 'left' | 'right', y = WORLD.height / 2): Paddle => ({
  side,
  x: side === 'left' ? PADDLE.margin : WORLD.width - PADDLE.margin,
  y,
  width: PADDLE.width,
  height: PADDLE.height,
  vy: 0,
  flash: 0,
});

describe('stepBall', () => {
  it('bounces off the top wall', () => {
    const ball = { ...createBall(), y: 15, vx: 0, vy: -600, speed: 600 };
    const events = stepBall(ball, [], 0.05);
    expect(ball.vy).toBeGreaterThan(0);
    expect(ball.y).toBeGreaterThanOrEqual(ball.radius);
    expect(events.some((e) => e.type === 'wall')).toBe(true);
  });

  it('never tunnels through a paddle at max speed', () => {
    const left = paddle('left');
    const ball = { ...createBall(), x: 300, y: left.y, vx: -BALL.maxSpeed, vy: 0, speed: BALL.maxSpeed };
    // One huge step that would carry the ball far past the paddle without sub-stepping.
    const events = stepBall(ball, [left], 0.2);
    expect(events.find((e) => e.type === 'paddle')).toBeDefined();
    expect(ball.vx).toBeGreaterThan(0);
  });

  it('reports a goal for the right player when the ball leaves on the left', () => {
    const ball = { ...createBall(), x: 5, y: 40, vx: -800, vy: 0, speed: 800 };
    const events = stepBall(ball, [paddle('left', WORLD.height - 80)], 0.1);
    expect(events).toContainEqual({ type: 'goal', scorer: 'right' });
  });
});

describe('collideWithPaddle', () => {
  it('speeds the ball up and caps the bounce angle', () => {
    const p = paddle('right');
    const ball = { ...createBall(), x: p.x - 15, y: p.y + p.height / 2, vx: 600, vy: 0, speed: 600 };
    expect(collideWithPaddle(ball, p)).toBe(true);
    expect(ball.vx).toBeLessThan(0);
    expect(ball.speed).toBe(600 + BALL.speedUpPerHit);
    const angle = Math.atan2(ball.vy, -ball.vx);
    expect(angle).toBeLessThanOrEqual(BALL.maxBounceAngle + 1e-9);
    expect(angle).toBeGreaterThan(0);
  });

  it('applies spin from a moving paddle', () => {
    const still = paddle('left');
    const moving = { ...paddle('left'), vy: 900 };
    const a = { ...createBall(), x: still.x + 15, y: still.y, vx: -600, vy: 0, speed: 600 };
    const b = { ...a };
    collideWithPaddle(a, still);
    collideWithPaddle(b, moving);
    expect(a.vy).toBeCloseTo(0);
    expect(b.vy).toBeGreaterThan(0);
  });

  it('ignores balls moving away from the paddle', () => {
    const p = paddle('left');
    const ball = { ...createBall(), x: p.x + 10, y: p.y, vx: 500, vy: 0, speed: 500 };
    expect(collideWithPaddle(ball, p)).toBe(false);
  });
});

describe('predictY', () => {
  it('matches a brute-force simulation through several wall bounces', () => {
    const ball = { ...createBall(), x: 200, y: 100, vx: 500, vy: 1400, speed: 1500 };
    const targetX = WORLD.width - 80;
    const predicted = predictY(ball, targetX)!;
    const sim = { ...ball };
    while (sim.x < targetX) stepBall(sim, [], 1 / 2000);
    // The discrete sim loses a fraction of a pixel at each wall clamp.
    expect(Math.abs(predicted - sim.y)).toBeLessThan(3);
  });

  it('returns null when the ball moves away', () => {
    const ball = { ...createBall(), vx: -300, vy: 0 };
    expect(predictY(ball, WORLD.width)).toBeNull();
  });
});

describe('serveBall / movePaddleToward', () => {
  it('serves toward the requested side at start speed', () => {
    const ball = createBall();
    serveBall(ball, 'left', () => 0.9);
    expect(ball.vx).toBeLessThan(0);
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(BALL.startSpeed);
  });

  it('respects max speed and the court bounds', () => {
    const p = paddle('left');
    movePaddleToward(p, -1000, 600, 0.1);
    expect(p.y).toBe(WORLD.height / 2 - 60);
    expect(p.vy).toBeCloseTo(-600);
    for (let i = 0; i < 50; i++) movePaddleToward(p, -1000, 600, 0.1);
    expect(p.y).toBe(p.height / 2);
  });
});
