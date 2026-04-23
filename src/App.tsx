import { useEffect, useMemo, useRef, useState } from "react";
import { base } from "wagmi/chains";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";

type Direction = "up" | "down" | "left" | "right";
type GameState = "ready" | "playing" | "gameover";

type Car = {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  color: string;
  wheelColor: string;
  direction: 1 | -1;
};

type Frog = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  hopTimer: number;
  hopDuration: number;
  facing: Direction;
  squash: number;
};

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 480;
const PLAYER_SIZE = 24;
const STEP = 24;
const GOAL_LINE = 42;
const START_Y = CANVAS_HEIGHT - PLAYER_SIZE - 14;
const ROAD_TOP = 112;
const ROAD_HEIGHT = 248;

const BASE_ERC8021_SUFFIX =
  "0x62635f373172746e3775680b0080218021802180218021802180218021" as const;

const LEADERBOARD_KEY = "frogger-base-leaderboard";

const CAR_COLORS = ["#e63946", "#f4a261", "#3a86ff", "#8338ec", "#ffbe0b"];

function createCars(difficulty = 1): Car[] {
  const speedBoost = 1 + difficulty * 0.08;
  return [
    { x: 16, y: 122, width: 58, height: 22, speed: 1.4 * speedBoost, color: CAR_COLORS[0], wheelColor: "#111", direction: 1 },
    { x: 284, y: 170, width: 54, height: 24, speed: -1.8 * speedBoost, color: CAR_COLORS[1], wheelColor: "#111", direction: -1 },
    { x: 152, y: 218, width: 62, height: 22, speed: 2.2 * speedBoost, color: CAR_COLORS[2], wheelColor: "#111", direction: 1 },
    { x: 38, y: 266, width: 56, height: 24, speed: -2.1 * speedBoost, color: CAR_COLORS[3], wheelColor: "#111", direction: -1 },
    { x: 208, y: 314, width: 60, height: 22, speed: 2.6 * speedBoost, color: CAR_COLORS[4], wheelColor: "#111", direction: 1 },
  ];
}

function createInitialFrog(): Frog {
  const startX = CANVAS_WIDTH / 2 - PLAYER_SIZE / 2;
  return {
    x: startX,
    y: START_Y,
    targetX: startX,
    targetY: START_Y,
    hopTimer: 0,
    hopDuration: 130,
    facing: "up",
    squash: 0,
  };
}

function readLeaderboard(): number[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as number[];
    return parsed.filter((n) => Number.isFinite(n)).slice(0, 5);
  } catch {
    return [];
  }
}

function writeLeaderboard(scores: number[]) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(scores.slice(0, 5)));
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const carsRef = useRef<Car[]>(createCars());
  const frogRef = useRef<Frog>(createInitialFrog());
  const scoreRef = useRef(0);
  const gameStateRef = useRef<GameState>("ready");
  const effectRef = useRef({ hit: 0, success: 0, time: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: connectPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameState, setGameState] = useState<GameState>("ready");
  const [leaderboard, setLeaderboard] = useState<number[]>([]);

  const [walletModalOpen, setWalletModalOpen] = useState(false);

  function getConnectorLabel(connectorId: string, connectorName: string) {
    if (connectorId === "coinbaseWalletSDK") return "Sign in with Base";
    if (connectorId.includes("brave")) return "Brave Wallet";
    if (connectorId.includes("rabby")) return "Rabby";
    return connectorName;
  }

  const prioritizedConnectors = useMemo(() => {
    const rank = (id: string) => {
      if (id === "coinbaseWalletSDK") return 0;
      if (id.includes("brave")) return 1;
      if (id.includes("rabby")) return 2;
      return 3;
    };

    return [...connectors].sort((a, b) => rank(a.id) - rank(b.id));
  }, [connectors]);

  const { data: txHash, isPending: txPending, sendTransaction, error: txError } =
    useSendTransaction();
  const { isLoading: txConfirming, isSuccess: txConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    setLeaderboard(readLeaderboard());
  }, []);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const isOnBase = chainId === base.id;
  const highScore = leaderboard[0] ?? 0;

  const statusText = useMemo(() => {
    if (!isConnected) return "Connect wallet to begin.";
    if (!isOnBase) return "Switch wallet network to Base.";
    if (txPending || txConfirming) return "Waiting for transaction confirmation...";
    if (gameState === "playing") return "Hop to the top and dodge traffic!";
    if (gameState === "gameover") return "Game over. Pay a new transaction to play again.";
    return "Ready. Pay transaction to start round.";
  }, [isConnected, isOnBase, txPending, txConfirming, gameState]);

  function withBaseDataSuffix(data?: `0x${string}`): `0x${string}` {
    if (!data || data === "0x") return BASE_ERC8021_SUFFIX;
    return `${data}${BASE_ERC8021_SUFFIX.slice(2)}` as `0x${string}`;
  }

  function ensureAudioContext() {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }
  }

  function playTone(freq: number, duration: number, type: OscillatorType, volume = 0.06, slide = 0) {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide !== 0) {
      osc.frequency.linearRampToValueAtTime(freq + slide, now + duration);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  function playSound(kind: "start" | "move" | "hit" | "score") {
    ensureAudioContext();
    if (kind === "start") {
      playTone(280, 0.08, "square", 0.05, 120);
      setTimeout(() => playTone(420, 0.08, "square", 0.05, 80), 80);
      return;
    }
    if (kind === "move") {
      playTone(520, 0.04, "square", 0.025, -80);
      return;
    }
    if (kind === "hit") {
      playTone(150, 0.12, "sawtooth", 0.055, -120);
      setTimeout(() => playTone(90, 0.15, "triangle", 0.04, -80), 60);
      return;
    }
    playTone(640, 0.06, "triangle", 0.04, 160);
    setTimeout(() => playTone(860, 0.05, "square", 0.03, 90), 55);
  }

  function resetGameState() {
    carsRef.current = createCars(1);
    frogRef.current = createInitialFrog();
    setScore(0);
    setLevel(1);
    effectRef.current.hit = 0;
    effectRef.current.success = 0;
  }

  function finishGame() {
    setGameState("gameover");
    effectRef.current.hit = 380;
    playSound("hit");
    const finalScore = scoreRef.current;
    const updated = [...leaderboard, finalScore].sort((a, b) => b - a).slice(0, 5);
    setLeaderboard(updated);
    writeLeaderboard(updated);
  }

  useEffect(() => {
    if (!txConfirmed || !isConnected) return;
    resetGameState();
    setGameState("playing");
    playSound("start");
  }, [txConfirmed, isConnected]);

  function movePlayer(direction: Direction) {
    if (gameStateRef.current !== "playing") return;

    ensureAudioContext();

    const frog = frogRef.current;
    if (frog.hopTimer > 0) return;

    let nextX = frog.targetX;
    let nextY = frog.targetY;

    if (direction === "up") nextY = Math.max(0, frog.targetY - STEP);
    if (direction === "down") nextY = Math.min(CANVAS_HEIGHT - PLAYER_SIZE, frog.targetY + STEP);
    if (direction === "left") nextX = Math.max(0, frog.targetX - STEP);
    if (direction === "right") nextX = Math.min(CANVAS_WIDTH - PLAYER_SIZE, frog.targetX + STEP);

    if (nextX === frog.targetX && nextY === frog.targetY) return;

    frog.targetX = nextX;
    frog.targetY = nextY;
    frog.facing = direction;
    frog.hopTimer = frog.hopDuration;
    frog.squash = 1;
    playSound("move");
  }

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") movePlayer("up");
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") movePlayer("down");
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") movePlayer("left");
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") movePlayer("right");
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastTime = performance.now();

    const drawCar = (car: Car, tick: number) => {
      const bounce = Math.sin(tick / 110 + car.y) * 0.6;
      const y = car.y + bounce;
      ctx.save();
      ctx.translate(Math.round(car.x), Math.round(y));
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(5, car.height - 2, car.width - 10, 4);

      ctx.fillStyle = car.color;
      ctx.fillRect(0, 4, car.width, car.height - 4);
      ctx.fillStyle = "rgba(255,255,255,0.36)";
      ctx.fillRect(6, 6, car.width - 18, 5);
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(10, 2, car.width - 24, 8);

      ctx.fillStyle = car.wheelColor;
      ctx.fillRect(6, car.height - 2, 8, 4);
      ctx.fillRect(car.width - 14, car.height - 2, 8, 4);

      ctx.fillStyle = "#ffd166";
      if (car.direction > 0) {
        ctx.fillRect(car.width - 4, 9, 3, 5);
      } else {
        ctx.fillRect(1, 9, 3, 5);
      }
      ctx.restore();
    };

    const drawFrog = (frog: Frog) => {
      const pulse = Math.sin(effectRef.current.time / 130) * 0.12;
      const squash = 1 + frog.squash * 0.2;
      const stretch = 1 - frog.squash * 0.12;

      ctx.save();
      ctx.translate(Math.round(frog.x + PLAYER_SIZE / 2), Math.round(frog.y + PLAYER_SIZE / 2));
      ctx.scale(squash, stretch + pulse * 0.08);
      ctx.translate(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2);

      ctx.fillStyle = "rgba(0,0,0,0.26)";
      ctx.fillRect(4, PLAYER_SIZE - 4, PLAYER_SIZE - 8, 4);

      ctx.fillStyle = "#165d2f";
      ctx.fillRect(3, 5, 18, 15);
      ctx.fillStyle = "#2dd36f";
      ctx.fillRect(5, 7, 14, 11);
      ctx.fillStyle = "#14532d";
      ctx.fillRect(1, 11, 5, 6);
      ctx.fillRect(18, 11, 5, 6);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(6, 3, 4, 4);
      ctx.fillRect(14, 3, 4, 4);
      ctx.fillStyle = "#111827";
      ctx.fillRect(7, 4, 2, 2);
      ctx.fillRect(15, 4, 2, 2);
      ctx.fillStyle = "#0b1f14";
      ctx.fillRect(9, 14, 6, 2);

      if (frog.facing === "left") {
        ctx.fillStyle = "#0b1f14";
        ctx.fillRect(2, 13, 3, 2);
      }
      if (frog.facing === "right") {
        ctx.fillStyle = "#0b1f14";
        ctx.fillRect(19, 13, 3, 2);
      }
      ctx.restore();
    };

    const drawScene = (time: number) => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      gradient.addColorStop(0, "#0f3f2f");
      gradient.addColorStop(0.35, "#22635d");
      gradient.addColorStop(0.36, "#2a2f37");
      gradient.addColorStop(1, "#12203f");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#3f9b45";
      ctx.fillRect(0, 0, CANVAS_WIDTH, 78);
      ctx.fillRect(0, 362, CANVAS_WIDTH, 118);

      ctx.fillStyle = "#15191e";
      ctx.fillRect(0, ROAD_TOP, CANVAS_WIDTH, ROAD_HEIGHT);

      ctx.fillStyle = "#1d4ed8";
      ctx.fillRect(0, 80, CANVAS_WIDTH, 26);

      for (let y = ROAD_TOP + 36; y < ROAD_TOP + ROAD_HEIGHT; y += 48) {
        for (let x = 8; x < CANVAS_WIDTH; x += 32) {
          ctx.fillStyle = "#fbbf24";
          ctx.fillRect(x, y, 16, 3);
        }
      }

      for (let x = 0; x < CANVAS_WIDTH; x += 12) {
        ctx.fillStyle = x % 24 === 0 ? "#2f855a" : "#256d48";
        ctx.fillRect(x, 0, 12, 12);
        ctx.fillRect(x, 468, 12, 12);
      }

      for (const car of carsRef.current) drawCar(car, time);
      drawFrog(frogRef.current);

      if (effectRef.current.success > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.65, effectRef.current.success / 240)})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = "#22c55e";
        ctx.font = "bold 20px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.fillText("+1 NICE!", CANVAS_WIDTH / 2, 56);
      }

      if (gameStateRef.current === "ready") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(24, 174, CANVAS_WIDTH - 48, 132);
        ctx.strokeStyle = "#93c5fd";
        ctx.strokeRect(24.5, 174.5, CANVAS_WIDTH - 49, 131);
        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 16px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.fillText("BASE FROGGER", CANVAS_WIDTH / 2, 216);
        ctx.font = "12px 'Press Start 2P', monospace";
        ctx.fillText("PAY TO START", CANVAS_WIDTH / 2, 252);
      }

      if (gameStateRef.current === "gameover") {
        const alpha = Math.min(0.72, 0.4 + Math.sin(time / 120) * 0.08);
        ctx.fillStyle = `rgba(127,29,29,${alpha})`;
        ctx.fillRect(20, 176, CANVAS_WIDTH - 40, 124);
        ctx.strokeStyle = "#fecaca";
        ctx.strokeRect(20.5, 176.5, CANVAS_WIDTH - 41, 123);
        ctx.fillStyle = "#fff1f2";
        ctx.font = "bold 16px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, 220);
        ctx.font = "12px 'Press Start 2P', monospace";
        ctx.fillText(`SCORE ${scoreRef.current}`, CANVAS_WIDTH / 2, 252);
      }

      if (effectRef.current.hit > 0) {
        const r = 20 + (380 - effectRef.current.hit) * 0.1;
        ctx.strokeStyle = `rgba(248,113,113,${effectRef.current.hit / 420})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(frogRef.current.x + 12, frogRef.current.y + 12, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = "#f8fafc";
      ctx.font = "10px 'Press Start 2P', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`SCORE ${scoreRef.current}`, 10, 18);
      ctx.textAlign = "right";
      ctx.fillText(`BEST ${highScore}`, CANVAS_WIDTH - 10, 18);
    };

    const tick = (time: number) => {
      const delta = Math.min(32, time - lastTime);
      lastTime = time;
      effectRef.current.time += delta;

      const frog = frogRef.current;
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

      if (gameStateRef.current === "playing") {
        for (const car of carsRef.current) {
          car.x += car.speed * (delta / 16.67);
          if (car.speed > 0 && car.x > CANVAS_WIDTH + 8) car.x = -car.width - 8;
          if (car.speed < 0 && car.x + car.width < -8) car.x = CANVAS_WIDTH + 8;
        }

        const hit = carsRef.current.some(
          (car) =>
            frog.x + 3 < car.x + car.width - 3 &&
            frog.x + PLAYER_SIZE - 3 > car.x + 3 &&
            frog.y + 5 < car.y + car.height - 4 &&
            frog.y + PLAYER_SIZE - 5 > car.y + 3
        );

        if (hit) {
          finishGame();
        } else if (frog.y <= GOAL_LINE) {
          effectRef.current.success = 220;
          playSound("score");
          const nextScore = scoreRef.current + 1;
          setScore(nextScore);
          if (nextScore % 3 === 0) {
            const nextLevel = Math.min(9, Math.floor(nextScore / 3) + 1);
            setLevel(nextLevel);
            carsRef.current = createCars(nextLevel);
          }
          frogRef.current = createInitialFrog();
        }
      }

      effectRef.current.hit = Math.max(0, effectRef.current.hit - delta);
      effectRef.current.success = Math.max(0, effectRef.current.success - delta);

      drawScene(time);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [highScore, leaderboard]);

  function startWithTransaction() {
    if (!address) return;
    ensureAudioContext();
    const transaction = {
      to: address,
      value: parseEther("0.000001"),
      chainId: base.id,
      data: undefined as `0x${string}` | undefined,
    } as const;

    sendTransaction({
      ...transaction,
      data: transaction.chainId === base.id ? withBaseDataSuffix(transaction.data) : transaction.data,
    });
  }

  return (
    <main className="container">
      <header className="hero">
        <h1>Base Frogger DX</h1>
        <p className="status">{statusText}</p>
      </header>

      <section className="card hud">
        <p>
          Wallet: {isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
        </p>
        <div className="stats">
          <p>Score: {score}</p>
          <p>High Score: {highScore}</p>
          <p>Level: {level}</p>
          <p>State: {gameState}</p>
          <p>Chain: {isOnBase ? "Base" : "Wrong network"}</p>
        </div>

        {!isConnected ? (
          <>
            <button className="primary" onClick={() => setWalletModalOpen(true)}>
              Connect Wallet
            </button>
            {walletModalOpen && (
              <div className="wallet-modal-overlay" onClick={() => setWalletModalOpen(false)} role="presentation">
                <div className="wallet-modal card" role="dialog" aria-modal="true" aria-label="Connect wallet" onClick={(event) => event.stopPropagation()}>
                  <div className="wallet-modal-header">
                    <h2>Connect Wallet</h2>
                    <button className="secondary" onClick={() => setWalletModalOpen(false)} aria-label="Close wallet modal">
                      Close
                    </button>
                  </div>
                  <p className="status">Choose a wallet to continue on Base.</p>
                  <div className="wallet-list">
                    {prioritizedConnectors.map((connector) => {
                      const isConnecting = connectPending;
                      return (
                        <button
                          key={connector.uid}
                          className={`wallet-option ${connector.id === "coinbaseWalletSDK" ? "primary" : "secondary"}`}
                          onClick={() => {
                            connect({ connector });
                            setWalletModalOpen(false);
                          }}
                          disabled={!connector.ready || isConnecting}
                        >
                          <span>{getConnectorLabel(connector.id, connector.name)}</span>
                          <small>{isConnecting ? "Connecting..." : connector.ready ? "Available" : "Not detected"}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="row">
            <button className="primary" onClick={startWithTransaction} disabled={!isOnBase || txPending || txConfirming}>
              {txPending || txConfirming ? "Confirming..." : "Pay & Start"}
            </button>
            <button className="secondary" onClick={() => disconnect()}>
              Disconnect
            </button>
          </div>
        )}

        {connectError && <p className="error">Wallet connection failed. Try a different wallet option.</p>}
        {txError && <p className="error">Transaction failed. Try again.</p>}
      </section>

      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="game" />

      <section className="controls" aria-label="game controls">
        <button className="arcade up" onClick={() => movePlayer("up")}>▲</button>
        <div className="row">
          <button className="arcade" onClick={() => movePlayer("left")}>◀</button>
          <button className="arcade" onClick={() => movePlayer("down")}>▼</button>
          <button className="arcade" onClick={() => movePlayer("right")}>▶</button>
        </div>
      </section>

      <button
        className="secondary full"
        onClick={() => {
          setGameState("ready");
          resetGameState();
        }}
      >
        Reset Board (new tx required)
      </button>

      <section className="card">
        <h2>Local Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p>No scores yet.</p>
        ) : (
          <ol>
            {leaderboard.map((entry, idx) => (
              <li key={`${entry}-${idx}`}>{entry}</li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
