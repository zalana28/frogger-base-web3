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
import { Attribution } from "ox/erc8021";

type Direction = "up" | "down" | "left" | "right";

type Car = {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
};

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 480;
const PLAYER_SIZE = 24;
const STEP = 24;
const GOAL_LINE = 28;

const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: ["69ea758b269d5b14147c9059"],
});

const LEADERBOARD_KEY = "frogger-base-leaderboard";

function createCars(): Car[] {
  return [
    { x: 20, y: 120, width: 54, height: 24, speed: 1.8 },
    { x: 280, y: 168, width: 54, height: 24, speed: -2.2 },
    { x: 160, y: 216, width: 54, height: 24, speed: 2.6 },
    { x: 40, y: 264, width: 60, height: 24, speed: -1.6 },
    { x: 220, y: 312, width: 54, height: 24, speed: 2.1 },
  ];
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
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: connectPending } = useConnect();
  const { disconnect } = useDisconnect();

  const [playerX, setPlayerX] = useState(CANVAS_WIDTH / 2 - PLAYER_SIZE / 2);
  const [playerY, setPlayerY] = useState(CANVAS_HEIGHT - PLAYER_SIZE - 10);
  const [cars, setCars] = useState<Car[]>(createCars());
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [leaderboard, setLeaderboard] = useState<number[]>([]);

  const { data: txHash, isPending: txPending, sendTransaction, error: txError } =
    useSendTransaction();
  const { isLoading: txConfirming, isSuccess: txConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    setLeaderboard(readLeaderboard());
  }, []);

  const isOnBase = chainId === base.id;

  const statusText = useMemo(() => {
    if (!isConnected) return "Connect wallet to begin.";
    if (!isOnBase) return "Switch wallet network to Base.";
    if (txPending || txConfirming) return "Waiting for transaction confirmation...";
    if (isPlaying) return "Game in progress";
    if (isGameOver) return "You were hit. Restart with a new transaction.";
    return "Send transaction to start game.";
  }, [isConnected, isOnBase, txPending, txConfirming, isPlaying, isGameOver]);

  useEffect(() => {
    if (!txConfirmed || !isConnected) return;
    resetGameState();
    setIsPlaying(true);
    setIsGameOver(false);
  }, [txConfirmed, isConnected]);

  function resetGameState() {
    setPlayerX(CANVAS_WIDTH / 2 - PLAYER_SIZE / 2);
    setPlayerY(CANVAS_HEIGHT - PLAYER_SIZE - 10);
    setCars(createCars());
    setScore(0);
  }

  function finishGame() {
    setIsPlaying(false);
    setIsGameOver(true);
    const updated = [...leaderboard, score].sort((a, b) => b - a).slice(0, 5);
    setLeaderboard(updated);
    writeLeaderboard(updated);
  }

  function movePlayer(direction: Direction) {
    if (!isPlaying) return;
    if (direction === "up") setPlayerY((y) => Math.max(0, y - STEP));
    if (direction === "down")
      setPlayerY((y) => Math.min(CANVAS_HEIGHT - PLAYER_SIZE, y + STEP));
    if (direction === "left") setPlayerX((x) => Math.max(0, x - STEP));
    if (direction === "right")
      setPlayerX((x) => Math.min(CANVAS_WIDTH - PLAYER_SIZE, x + STEP));
  }

  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setCars((prevCars) =>
        prevCars.map((car) => {
          const nextX = car.x + car.speed;
          if (car.speed > 0 && nextX > CANVAS_WIDTH) {
            return { ...car, x: -car.width };
          }
          if (car.speed < 0 && nextX + car.width < 0) {
            return { ...car, x: CANVAS_WIDTH + car.width };
          }
          return { ...car, x: nextX };
        })
      );
    }, 16);

    return () => clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;

    const hit = cars.some(
      (car) =>
        playerX < car.x + car.width &&
        playerX + PLAYER_SIZE > car.x &&
        playerY < car.y + car.height &&
        playerY + PLAYER_SIZE > car.y
    );

    if (hit) {
      finishGame();
      return;
    }

    if (playerY <= GOAL_LINE) {
      setScore((s) => s + 1);
      setPlayerY(CANVAS_HEIGHT - PLAYER_SIZE - 10);
      setPlayerX(CANVAS_WIDTH / 2 - PLAYER_SIZE / 2);
    }
  }, [cars, isPlaying, playerX, playerY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "#0a1a35";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "#1e7a3f";
    ctx.fillRect(0, 0, CANVAS_WIDTH, GOAL_LINE + 10);

    ctx.fillStyle = "#2d2d2d";
    ctx.fillRect(0, 95, CANVAS_WIDTH, 260);

    ctx.strokeStyle = "#e4d08f";
    ctx.setLineDash([10, 10]);
    for (let y = 145; y < 340; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.fillStyle = "#ef4444";
    for (const car of cars) {
      ctx.fillRect(car.x, car.y, car.width, car.height);
    }

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(playerX, playerY, PLAYER_SIZE, PLAYER_SIZE);
  }, [cars, playerX, playerY]);

  function startWithTransaction() {
    if (!address) return;
    sendTransaction({
      to: address,
      value: parseEther("0.000001"),
      data: DATA_SUFFIX,
      chainId: base.id,
    });
  }

  return (
    <main className="container">
      <h1>Base Frogger</h1>
      <p className="status">{statusText}</p>

      <section className="card">
        <p>
          Wallet: {isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
        </p>
        <p>Score: {score}</p>
        <p>Chain: {isOnBase ? "Base" : "Wrong network"}</p>

        {!isConnected ? (
          <button
            className="primary"
            onClick={() => connect({ connector: connectors[0] })}
            disabled={connectPending || connectors.length === 0}
          >
            {connectPending ? "Connecting..." : "Connect Wallet"}
          </button>
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

        {txError && <p className="error">Transaction failed. Try again.</p>}
      </section>

      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="game" />

      <section className="controls">
        <button onClick={() => movePlayer("up")}>↑</button>
        <div className="row">
          <button onClick={() => movePlayer("left")}>←</button>
          <button onClick={() => movePlayer("down")}>↓</button>
          <button onClick={() => movePlayer("right")}>→</button>
        </div>
      </section>

      <button
        className="secondary full"
        onClick={() => {
          setIsPlaying(false);
          setIsGameOver(false);
          resetGameState();
        }}
      >
        Restart (requires new tx)
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
