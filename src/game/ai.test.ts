import { describe, expect, it } from 'vitest';
import { AiController } from './ai';
import { AI_PROFILES, PADDLE, WORLD } from './config';
import { createBall, serveBall, stepBall } from './physics';
import type { Paddle } from './types';

const rightPaddle = (): Paddle => ({
  side: 'right',
  x: WORLD.width - PADDLE.margin,
  y: WORLD.height / 2,
  width: PADDLE.width,
  height: PADDLE.height,
  vy: 0,
  flash: 0,
});

/** Returns the share of serves the AI manages to return. */
function returnRate(profile: keyof typeof AI_PROFILES, trials = 200): number {
  let seed = 42;
  const rng = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let returned = 0;
  for (let i = 0; i < trials; i++) {
    const ai = new AiController(AI_PROFILES[profile], rng);
    const paddle = rightPaddle();
    paddle.y = rng() * WORLD.height;
    const ball = createBall();
    serveBall(ball, 'right', rng);
    ball.vy *= 2.2; // steep shots that bounce off walls
    ai.rerollError();
    for (let t = 0; t < 600; t++) {
      ai.update(paddle, ball, 1 / 120);
      const events = stepBall(ball, [paddle], 1 / 120);
      if (events.some((e) => e.type === 'paddle')) { returned++; break; }
      if (events.some((e) => e.type === 'goal')) break;
    }
  }
  return returned / trials;
}

describe('AiController', () => {
  it('gets better with difficulty', () => {
    const easy = returnRate('easy');
    const insane = returnRate('insane');
    expect(insane).toBeGreaterThan(0.95);
    expect(easy).toBeLessThan(insane);
  });
});
