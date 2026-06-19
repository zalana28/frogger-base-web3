// ---- Sprite Grid System & Drawing Helpers ----

export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 480;
export const PLAYER_SIZE = 24;
export const STEP = 24;
export const GOAL_LINE = 42;
export const START_Y = CANVAS_HEIGHT - PLAYER_SIZE - 14;
export const ROAD_TOP = 112;
export const ROAD_HEIGHT = 248;

export const CAR_COLORS = ['#e63946', '#f4a261', '#3a86ff', '#8338ec', '#ffbe0b'];

// ---- Types ----

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

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

export type Firefly = {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  phase: number;
  speed: number;
};

export type WaterSparkle = {
  x: number;
  y: number;
  phase: number;
};

export type LilyPad = {
  x: number;
  y: number;
  size: number;
  phase: number;
  rotation: number;
};

// ---- drawSprite helper ----

/**
 * Draw a pixel-art sprite from a 2D number grid onto the canvas.
 * Each value in the grid maps to a palette color (0 = transparent).
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  grid: number[][],
  palette: string[],
  x: number,
  y: number,
  scale = 2,
) {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const colorIdx = grid[row][col];
      if (colorIdx === 0) continue; // transparent
      ctx.fillStyle = palette[colorIdx];
      ctx.fillRect(
        Math.round(x + col * scale),
        Math.round(y + row * scale),
        scale,
        scale,
      );
    }
  }
}

// ---- Frog Sprites (12×12 pixel grids, 4 directions) ----

// Palette: 0=transparent, 1=dark outline, 2=dark green, 3=bright green, 4=light belly, 5=white eye, 6=black pupil
const FROG_PALETTE: string[] = [
  'transparent',   // 0
  '#0b1f14',      // 1 - dark outline
  '#14532d',      // 2 - dark green
  '#2dd36f',      // 3 - bright green
  '#86efac',      // 4 - light belly
  '#f8fafc',      // 5 - white eye
  '#111827',      // 6 - black pupil
];

const FROG_UP: number[][] = [
  [0,0,0,0,5,6,0,5,6,0,0,0],
  [0,0,0,1,1,1,1,1,1,0,0,0],
  [0,0,1,5,6,1,1,5,6,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,0,0],
  [0,1,2,1,1,1,1,1,1,2,1,0],
  [0,1,3,3,1,1,1,1,3,3,1,0],
  [1,2,3,4,3,3,3,3,4,3,2,1],
  [1,3,4,4,3,3,3,3,4,4,3,1],
  [1,3,3,3,3,3,3,3,3,3,3,1],
  [1,1,3,1,3,3,3,3,1,3,1,1],
  [0,1,1,0,1,1,1,1,0,1,1,0],
  [0,0,0,0,1,1,1,1,0,0,0,0],
];

const FROG_DOWN: number[][] = [
  [0,0,0,0,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0,0],
  [0,1,1,0,1,1,1,1,0,1,1,0],
  [1,1,3,1,3,3,3,3,1,3,1,1],
  [1,3,3,3,3,3,3,3,3,3,3,1],
  [1,3,4,4,3,3,3,3,4,4,3,1],
  [1,2,3,4,3,3,3,3,4,3,2,1],
  [0,1,3,3,1,1,1,1,3,3,1,0],
  [0,1,2,1,1,1,1,1,1,2,1,0],
  [0,0,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0,0],
];

const FROG_LEFT: number[][] = [
  [0,0,0,0,0,0,0,0,0,1,1,0],
  [0,0,0,0,0,0,0,0,1,2,1,0],
  [0,5,6,0,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,2,1,1],
  [0,1,1,2,2,1,1,1,1,1,2,1],
  [1,2,3,3,4,3,3,3,3,3,3,1],
  [1,3,4,4,4,3,3,3,3,3,2,1],
  [1,2,3,3,3,3,3,3,3,3,1,0],
  [0,1,2,1,1,1,1,1,3,2,1,0],
  [0,0,1,1,0,1,1,1,2,1,0,0],
  [0,0,1,1,0,0,1,1,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
];

const FROG_RIGHT: number[][] = [
  [0,1,1,0,0,0,0,0,0,0,0,0],
  [0,1,2,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,0,6,5,0],
  [1,1,2,1,1,1,1,1,1,1,1,0],
  [1,2,1,1,1,1,1,1,2,2,1,0],
  [1,3,3,3,3,3,3,3,4,3,3,2,1],
  [1,2,3,3,3,3,3,3,3,4,4,4,3],
  [0,1,3,3,3,3,3,3,3,3,3,3,2],
  [0,1,2,3,1,1,1,1,1,1,2,1,0],
  [0,0,1,2,1,1,1,0,1,1,1,0,0],
  [0,0,0,1,1,1,0,0,1,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
];

const FROG_SPRITES: Record<string, number[][]> = {
  up: FROG_UP,
  down: FROG_DOWN,
  left: FROG_LEFT,
  right: FROG_RIGHT,
};

// ---- Car Sprites (8×6 pixel grids, 5 types) ----

// Car with headlight on right
const CAR_GRID_RIGHT_HL: number[][] = [
  [0,0,3,3,3,3,5,0],
  [3,2,2,2,2,2,2,3],
  [3,2,2,2,2,2,2,3],
  [1,1,1,1,1,1,1,1],
  [0,4,1,1,1,1,4,0],
  [0,4,0,0,0,0,4,0],
];

// Alternative car with headlight on left
const CAR_GRID_LEFT_HL: number[][] = [
  [0,5,3,3,3,3,3,0],
  [3,2,2,2,2,2,2,3],
  [3,2,2,2,2,2,2,3],
  [1,1,1,1,1,1,1,1],
  [0,4,1,1,1,1,4,0],
  [0,4,0,0,0,0,4,0],
];

function carPaletteWithHL(color: string): string[] {
  return [
    'transparent',
    color,
    '#1f2937',
    color,
    '#111827',
    '#ffd166',   // 5 - headlight
  ];
}

// ---- Entity Creation ----

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

/** Create ambient fireflies for grass zones. */
export function createFireflies(): Firefly[] {
  const result: Firefly[] = [];
  for (let i = 0; i < 10; i++) {
    const topGrass = i < 5;
    const baseX = Math.random() * CANVAS_WIDTH;
    const baseY = topGrass
      ? 8 + Math.random() * 60
      : 370 + Math.random() * 90;
    result.push({
      x: baseX,
      y: baseY,
      baseX,
      baseY,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.5,
    });
  }
  return result;
}

/** Create water sparkle points. */
export function createWaterSparkles(): WaterSparkle[] {
  const result: WaterSparkle[] = [];
  for (let i = 0; i < 8; i++) {
    result.push({
      x: 10 + Math.random() * (CANVAS_WIDTH - 20),
      y: 82 + Math.random() * 22,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return result;
}

/** Create lily pads for the water zone. */
export function createLilyPads(): LilyPad[] {
  return [
    { x: 40, y: 90, size: 10, phase: 0, rotation: 0.3 },
    { x: 160, y: 86, size: 12, phase: 1.5, rotation: 1.1 },
    { x: 280, y: 92, size: 9, phase: 3.0, rotation: 2.2 },
    { x: 110, y: 100, size: 8, phase: 4.5, rotation: 0.8 },
  ];
}

// ---- Particle Factory ----

/** Spawn an explosion of particles at (x, y). */
export function spawnExplosion(
  particles: Particle[],
  x: number,
  y: number,
  colors: string[],
) {
  const count = 15 + Math.floor(Math.random() * 10);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 2.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 400 + Math.random() * 300,
      maxLife: 400 + Math.random() * 300,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 2 + Math.random() * 3,
    });
  }
}

/** Spawn sparkle particles drifting upward. */
export function spawnSparkles(
  particles: Particle[],
  x: number,
  y: number,
  colors: string[],
) {
  const count = 10 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x - 10 + Math.random() * 20,
      y: y - 5 + Math.random() * 10,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -0.5 - Math.random() * 1.5,
      life: 300 + Math.random() * 400,
      maxLife: 300 + Math.random() * 400,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 1.5 + Math.random() * 2,
    });
  }
}

/** Update particles — move, decay, remove dead ones. */
export function updateParticles(particles: Particle[], delta: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * (delta / 16.67);
    p.y += p.vy * (delta / 16.67);
    p.life -= delta;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// ---- Draw Functions ----

/** Draw a car using sprite grids. */
export function drawCar(ctx: CanvasRenderingContext2D, car: Car, tick: number) {
  const bounce = Math.sin(tick / 110 + car.y) * 0.6;
  const y = car.y + bounce;

  ctx.save();
  ctx.translate(Math.round(car.x), Math.round(y));

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(4, car.height, car.width - 8, 4);

  // Scale factor to fill car width from 8-pixel sprite
  const scale = car.width / 16;

  // Choose grid with headlight on correct side
  const grid = car.direction > 0 ? CAR_GRID_RIGHT_HL : CAR_GRID_LEFT_HL;
  const palette = carPaletteWithHL(car.color);

  // Draw the base sprite scaled to fill width
  drawSprite(ctx, grid, palette, 0, 2, scale);

  // Highlight stripe across the middle
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(2 * scale, 5 * scale, (car.width - 4 * scale), scale * 0.8);

  ctx.restore();
}

/** Draw the frog using sprite grids. */
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

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.fillRect(-PLAYER_SIZE / 2 + 4, PLAYER_SIZE / 2 - 3, PLAYER_SIZE - 8, 4);

  // Sprite is 12×12 at scale=2 = 24×24 (PLAYER_SIZE)
  const grid = FROG_SPRITES[frog.facing] || FROG_UP;
  const offset = -PLAYER_SIZE / 2;
  drawSprite(ctx, grid, FROG_PALETTE, offset, offset, 2);

  ctx.restore();
}

/** Draw a lily pad on the water. */
export function drawLilyPad(
  ctx: CanvasRenderingContext2D,
  pad: LilyPad,
  time: number,
) {
  const bob = Math.sin(time / 600 + pad.phase) * 1.5;
  const x = pad.x;
  const y = pad.y + bob;
  const r = pad.size;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(pad.rotation);

  // Pad body
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, 0.15, Math.PI * 2 - 0.15);
  ctx.closePath();
  ctx.fill();

  // Lighter inner
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r * 0.6, 0.2, Math.PI * 2 - 0.2);
  ctx.closePath();
  ctx.fill();

  // Vein lines
  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    const angle = 0.5 + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * r * 0.85, Math.sin(angle) * r * 0.85);
    ctx.stroke();
  }

  ctx.restore();
}

/** Draw a firefly. */
export function drawFirefly(
  ctx: CanvasRenderingContext2D,
  fly: Firefly,
  time: number,
) {
  const brightness = (Math.sin(time / 400 + fly.phase) + 1) / 2;
  if (brightness < 0.1) return;

  const glow = ctx.createRadialGradient(fly.x, fly.y, 0, fly.x, fly.y, 6);
  glow.addColorStop(0, `rgba(253,224,71,${brightness * 0.8})`);
  glow.addColorStop(0.5, `rgba(253,224,71,${brightness * 0.3})`);
  glow.addColorStop(1, 'rgba(253,224,71,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(fly.x - 6, fly.y - 6, 12, 12);

  // Core dot
  ctx.fillStyle = `rgba(255,255,220,${brightness})`;
  ctx.fillRect(fly.x - 1, fly.y - 1, 2, 2);
}

/** Draw particles on canvas. */
export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Draw frog glow/aura around the frog. */
export function drawFrogGlow(
  ctx: CanvasRenderingContext2D,
  frog: Frog,
  time: number,
) {
  const cx = frog.x + PLAYER_SIZE / 2;
  const cy = frog.y + PLAYER_SIZE / 2;
  const baseRadius = 18;
  const pulseRadius = baseRadius + Math.sin(time / 200) * 4;

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseRadius);
  glow.addColorStop(0, 'rgba(34,197,94,0.18)');
  glow.addColorStop(0.6, 'rgba(34,197,94,0.06)');
  glow.addColorStop(1, 'rgba(34,197,94,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
  ctx.fill();
}
