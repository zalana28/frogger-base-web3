// ---- Sprite drawing helpers ----

export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 480;
export const PLAYER_SIZE = 24;
export const STEP = 24;
export const GOAL_LINE = 42;
export const START_Y = CANVAS_HEIGHT - PLAYER_SIZE - 14;
export const ROAD_TOP = 112;
export const ROAD_HEIGHT = 248;

export const CAR_COLORS = ['#e63946', '#f4a261', '#3a86ff', '#8338ec', '#ffbe0b'];

export type Car = {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  color: string;
  wheelColor: string;
  direction: 1 | -1;
};

export type Frog = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  hopTimer: number;
  hopDuration: number;
  facing: 'up' | 'down' | 'left' | 'right';
  squash: number;
};

/** Create cars for a given difficulty level. */
export function createCars(difficulty = 1): Car[] {
  const speedBoost = 1 + difficulty * 0.08;
  return [
    { x: 16, y: 122, width: 58, height: 22, speed: 1.4 * speedBoost, color: CAR_COLORS[0], wheelColor: '#111', direction: 1 },
    { x: 284, y: 170, width: 54, height: 24, speed: -1.8 * speedBoost, color: CAR_COLORS[1], wheelColor: '#111', direction: -1 },
    { x: 152, y: 218, width: 62, height: 22, speed: 2.2 * speedBoost, color: CAR_COLORS[2], wheelColor: '#111', direction: 1 },
    { x: 38, y: 266, width: 56, height: 24, speed: -2.1 * speedBoost, color: CAR_COLORS[3], wheelColor: '#111', direction: -1 },
    { x: 208, y: 314, width: 60, height: 22, speed: 2.6 * speedBoost, color: CAR_COLORS[4], wheelColor: '#111', direction: 1 },
  ];
}

/** Create the initial frog at the starting position. */
export function createInitialFrog(): Frog {
  const startX = CANVAS_WIDTH / 2 - PLAYER_SIZE / 2;
  return {
    x: startX,
    y: START_Y,
    targetX: startX,
    targetY: START_Y,
    hopTimer: 0,
    hopDuration: 130,
    facing: 'up',
    squash: 0,
  };
}

/** Draw a car on the canvas. */
export function drawCar(ctx: CanvasRenderingContext2D, car: Car, tick: number) {
  const bounce = Math.sin(tick / 110 + car.y) * 0.6;
  const y = car.y + bounce;
  ctx.save();
  ctx.translate(Math.round(car.x), Math.round(y));
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(5, car.height - 2, car.width - 10, 4);

  ctx.fillStyle = car.color;
  ctx.fillRect(0, 4, car.width, car.height - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.36)';
  ctx.fillRect(6, 6, car.width - 18, 5);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(10, 2, car.width - 24, 8);

  ctx.fillStyle = car.wheelColor;
  ctx.fillRect(6, car.height - 2, 8, 4);
  ctx.fillRect(car.width - 14, car.height - 2, 8, 4);

  ctx.fillStyle = '#ffd166';
  if (car.direction > 0) {
    ctx.fillRect(car.width - 4, 9, 3, 5);
  } else {
    ctx.fillRect(1, 9, 3, 5);
  }
  ctx.restore();
}

/** Draw the frog on the canvas. */
export function drawFrog(
  ctx: CanvasRenderingContext2D,
  frog: Frog,
  time: number,
) {
  const pulse = Math.sin(time / 130) * 0.12;
  const squash = 1 + frog.squash * 0.2;
  const stretch = 1 - frog.squash * 0.12;

  ctx.save();
  ctx.translate(
    Math.round(frog.x + PLAYER_SIZE / 2),
    Math.round(frog.y + PLAYER_SIZE / 2),
  );
  ctx.scale(squash, stretch + pulse * 0.08);
  ctx.translate(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2);

  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.fillRect(4, PLAYER_SIZE - 4, PLAYER_SIZE - 8, 4);

  ctx.fillStyle = '#165d2f';
  ctx.fillRect(3, 5, 18, 15);
  ctx.fillStyle = '#2dd36f';
  ctx.fillRect(5, 7, 14, 11);
  ctx.fillStyle = '#14532d';
  ctx.fillRect(1, 11, 5, 6);
  ctx.fillRect(18, 11, 5, 6);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(6, 3, 4, 4);
  ctx.fillRect(14, 3, 4, 4);
  ctx.fillStyle = '#111827';
  ctx.fillRect(7, 4, 2, 2);
  ctx.fillRect(15, 4, 2, 2);
  ctx.fillStyle = '#0b1f14';
  ctx.fillRect(9, 14, 6, 2);

  if (frog.facing === 'left') {
    ctx.fillStyle = '#0b1f14';
    ctx.fillRect(2, 13, 3, 2);
  }
  if (frog.facing === 'right') {
    ctx.fillStyle = '#0b1f14';
    ctx.fillRect(19, 13, 3, 2);
  }
  ctx.restore();
}
