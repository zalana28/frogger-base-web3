// Base Frogger DX — Game Engine
// Self-contained module. Call `createEngine(canvas, callbacks)` to get an engine instance.

import {
  CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_SIZE, STEP, GOAL_LINE,
  ROAD_TOP, ROAD_HEIGHT,
  createCars, createInitialFrog, drawCar, drawFrog,
} from './sprites.js';
import { playSound } from './audio.js';

// ---- Constants ----
const STATE = { MENU: 0, PLAY: 1, PAUSE: 2, OVER: 3 };

// ---- Factory ----

/**
 * Create a game engine attached to the given canvas.
 * @param canvas - HTMLCanvasElement to render into
 * @param cb - Callbacks:
 *   - onScoreChange(score: number, level: number)
 *   - onGameOver(score: number, level: number)
 */
export function createEngine(
  canvas: HTMLCanvasElement,
  cb: {
    onScoreChange?: (score: number, level: number) => void;
    onGameOver?: (score: number, level: number) => void;
  } = {},
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2d context');

  let state = STATE.MENU;
  let animFrameId: number | null = null;

  // Player
  const frogRef = createInitialFrog();
  let cars = createCars(1);
  let score = 0;
  let level = 1;

  // Effects
  let effectHit = 0;
  let effectSuccess = 0;
  let effectTime = 0;

  // Input
  type Direction = 'up' | 'down' | 'left' | 'right';
  const keys = { up: false, down: false, left: false, right: false };

  // High score (read once from localStorage)
  let highScore = 0;
  try {
    const raw = localStorage.getItem('frogger-base-high-score');
    if (raw) highScore = Number(raw) || 0;
  } catch { /* ignore */ }

  // ---- Helpers ----

  function notifyHUD() {
    cb.onScoreChange?.(score, level);
  }

  function finishGame() {
    state = STATE.OVER;
    effectHit = 380;
    playSound('hit');
    if (score > highScore) {
      highScore = score;
      try { localStorage.setItem('frogger-base-high-score', String(highScore)); } catch { /* ignore */ }
    }
    setTimeout(() => {
      cb.onGameOver?.(score, level);
    }, 200);
  }

  // ---- Movement ----

  function movePlayer(direction: Direction) {
    if (state !== STATE.PLAY) return;

    const frog = frogRef;
    if (frog.hopTimer > 0) return;

    let nextX = frog.targetX;
    let nextY = frog.targetY;

    if (direction === 'up') nextY = Math.max(0, frog.targetY - STEP);
    if (direction === 'down') nextY = Math.min(CANVAS_HEIGHT - PLAYER_SIZE, frog.targetY + STEP);
    if (direction === 'left') nextX = Math.max(0, frog.targetX - STEP);
    if (direction === 'right') nextX = Math.min(CANVAS_WIDTH - PLAYER_SIZE, frog.targetX + STEP);

    if (nextX === frog.targetX && nextY === frog.targetY) return;

    frog.targetX = nextX;
    frog.targetY = nextY;
    frog.facing = direction;
    frog.hopTimer = frog.hopDuration;
    frog.squash = 1;
    playSound('move');
  }

  // ---- Render ----

  function drawScene(time: number) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0f3f2f');
    gradient.addColorStop(0.35, '#22635d');
    gradient.addColorStop(0.36, '#2a2f37');
    gradient.addColorStop(1, '#12203f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grass
    ctx.fillStyle = '#3f9b45';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 78);
    ctx.fillRect(0, 362, CANVAS_WIDTH, 118);

    // Road
    ctx.fillStyle = '#15191e';
    ctx.fillRect(0, ROAD_TOP, CANVAS_WIDTH, ROAD_HEIGHT);

    // Water
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 80, CANVAS_WIDTH, 26);

    // Road dashes
    for (let y = ROAD_TOP + 36; y < ROAD_TOP + ROAD_HEIGHT; y += 48) {
      for (let x = 8; x < CANVAS_WIDTH; x += 32) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x, y, 16, 3);
      }
    }

    // Grass edge tiles
    for (let x = 0; x < CANVAS_WIDTH; x += 12) {
      ctx.fillStyle = x % 24 === 0 ? '#2f855a' : '#256d48';
      ctx.fillRect(x, 0, 12, 12);
      ctx.fillRect(x, 468, 12, 12);
    }

    // Entities
    for (const car of cars) drawCar(ctx, car, time);
    drawFrog(ctx, frogRef, effectTime);

    // Success flash
    if (effectSuccess > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.65, effectSuccess / 240)})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#22c55e';
      ctx.font = "bold 20px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('+1 NICE!', CANVAS_WIDTH / 2, 56);
    }

    // Hit ring
    if (effectHit > 0) {
      const r = 20 + (380 - effectHit) * 0.1;
      ctx.strokeStyle = `rgba(248,113,113,${effectHit / 420})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(frogRef.x + 12, frogRef.y + 12, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // HUD text on canvas
    ctx.fillStyle = '#f8fafc';
    ctx.font = "10px 'Press Start 2P', monospace";
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${score}`, 10, 18);
    ctx.textAlign = 'right';
    ctx.fillText(`BEST ${highScore}`, CANVAS_WIDTH - 10, 18);
  }

  // ---- Update ----

  function update(time: number, delta: number) {
    effectTime += delta;

    const frog = frogRef;
    if (frog.hopTimer > 0) {
      const progress = Math.min(1, 1 - frog.hopTimer / frog.hopDuration);
      const eased = 1 - Math.pow(1 - progress, 3);
      frog.x += (frog.targetX - frog.x) * eased;
      frog.y += (frog.targetY - frog.y) * eased;
      frog.hopTimer = Math.max(0, frog.hopTimer - delta);
      frog.squash = Math.max(0, frog.squash - delta / 160);
      if (frog.hopTimer <= 0) {
        frog.x = frog.targetX;
        frog.y = frog.targetY;
      }
    }

    if (state !== STATE.PLAY) return;

    // Move cars
    for (const car of cars) {
      car.x += car.speed * (delta / 16.67);
      if (car.speed > 0 && car.x > CANVAS_WIDTH + 8) car.x = -car.width - 8;
      if (car.speed < 0 && car.x + car.width < -8) car.x = CANVAS_WIDTH + 8;
    }

    // Collision detection
    const hit = cars.some(
      (car) =>
        frog.x + 3 < car.x + car.width - 3 &&
        frog.x + PLAYER_SIZE - 3 > car.x + 3 &&
        frog.y + 5 < car.y + car.height - 4 &&
        frog.y + PLAYER_SIZE - 5 > car.y + 3,
    );

    if (hit) {
      finishGame();
    } else if (frog.y <= GOAL_LINE) {
      // Reached goal!
      effectSuccess = 220;
      playSound('score');
      score += 1;
      if (score % 3 === 0) {
        level = Math.min(9, Math.floor(score / 3) + 1);
        cars = createCars(level);
      }
      // Reset frog to start
      const startX = CANVAS_WIDTH / 2 - PLAYER_SIZE / 2;
      frog.x = startX;
      frog.y = CANVAS_HEIGHT - PLAYER_SIZE - 14;
      frog.targetX = startX;
      frog.targetY = CANVAS_HEIGHT - PLAYER_SIZE - 14;
      frog.hopTimer = 0;
      frog.facing = 'up';
      frog.squash = 0;
      notifyHUD();
    }

    // Decay effects
    effectHit = Math.max(0, effectHit - delta);
    effectSuccess = Math.max(0, effectSuccess - delta);
  }

  // ---- Loop ----

  let lastTime = performance.now();

  function loop(time: number) {
    const delta = Math.min(32, time - lastTime);
    lastTime = time;

    update(time, delta);
    drawScene(time);

    animFrameId = requestAnimationFrame(loop);
  }

  function resetGame() {
    const newFrog = createInitialFrog();
    frogRef.x = newFrog.x;
    frogRef.y = newFrog.y;
    frogRef.targetX = newFrog.targetX;
    frogRef.targetY = newFrog.targetY;
    frogRef.hopTimer = 0;
    frogRef.facing = 'up';
    frogRef.squash = 0;

    cars = createCars(1);
    score = 0;
    level = 1;
    effectHit = 0;
    effectSuccess = 0;
    effectTime = 0;
    notifyHUD();
  }

  // ---- Public API ----

  return {
    /** Start / resume the game loop and begin a new session */
    start() {
      state = STATE.PLAY;
      resetGame();
      playSound('start');
      if (!animFrameId) {
        lastTime = performance.now();
        loop(lastTime);
      }
    },

    /** Pause the game */
    pause() {
      if (state === STATE.PLAY) state = STATE.PAUSE;
    },

    /** Resume from pause */
    resume() {
      if (state === STATE.PAUSE) state = STATE.PLAY;
    },

    /** Stop the loop and reset to menu state */
    stop() {
      state = STATE.MENU;
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    },

    /** @returns true if the engine is currently in PLAY state */
    isPlaying() {
      return state === STATE.PLAY;
    },

    /** @returns true if game is over */
    isGameOver() {
      return state === STATE.OVER;
    },

    // Keyboard input bindings
    keyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') { keys.up = true; movePlayer('up'); }
      if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') { keys.down = true; movePlayer('down'); }
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') { keys.left = true; movePlayer('left'); }
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') { keys.right = true; movePlayer('right'); }
    },

    keyUp(e: KeyboardEvent) {
      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') keys.up = false;
      if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') keys.down = false;
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') keys.left = false;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keys.right = false;
    },

    // Touch helpers — for mobile D-pad controls
    touchUp()   { movePlayer('up'); },
    touchDown()  { movePlayer('down'); },
    touchLeft()  { movePlayer('left'); },
    touchRight() { movePlayer('right'); },

    /** Get current score */
    getScore() { return score; },
    /** Get current level */
    getLevel() { return level; },
    /** Get high score */
    getHighScore() { return highScore; },
  };
}
