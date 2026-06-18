import { useState, useCallback, useEffect } from 'react';
import WalletGate from './components/WalletGate';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import PauseOverlay from './components/PauseOverlay';
import GameOverOverlay from './components/GameOverOverlay';
import Leaderboard from './components/Leaderboard';

/**
 * Game phases:
 *  'wallet' — show WalletGate (must connect + recordPlay before playing)
 *  'playing' — game is active
 *  'paused' — game is paused
 *  'over' — game over screen
 *  'leaderboard' — leaderboard overlay (on top of wallet or over)
 */
export default function App() {
  const [phase, setPhase] = useState('wallet'); // start at wallet gate
  const [hud, setHud] = useState({ score: 0, level: 1 });
  const [finalScore, setFinalScore] = useState(0);
  const [finalLevel, setFinalLevel] = useState(1);
  const [showLB, setShowLB] = useState(false);

  // Called when wallet gate confirms recordPlay tx
  const handleWalletReady = useCallback(() => {
    setPhase('playing');
  }, []);

  // Game engine HUD updates
  const handleScoreChange = useCallback((score: number, level: number) => {
    setHud({ score, level });
  }, []);

  // Game over callback
  const handleGameOver = useCallback((score: number, level: number) => {
    setFinalScore(score);
    setFinalLevel(level);
    setPhase('over');
  }, []);

  // Pause / resume
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showLB) { setShowLB(false); e.preventDefault(); return; }
        if (phase === 'playing') { setPhase('paused'); e.preventDefault(); return; }
        if (phase === 'paused') { setPhase('playing'); e.preventDefault(); return; }
      }
      if (e.key === 'p' || e.key === 'P') {
        if (phase === 'playing') setPhase('paused');
        else if (phase === 'paused') setPhase('playing');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, showLB]);

  // Play again (from game over)
  const handlePlayAgain = useCallback(() => {
    setPhase('playing');
  }, []);

  // Quit to wallet gate
  const handleQuit = useCallback(() => {
    setPhase('wallet');
  }, []);

  // Leaderboard open/close
  const handleOpenLB = useCallback(() => {
    setShowLB(true);
  }, []);

  const handleCloseLB = useCallback(() => {
    setShowLB(false);
  }, []);

  const isPlaying = phase === 'playing';

  return (
    <>
      {/* Game canvas — always mounted, engine starts/stops based on phase */}
      <GameCanvas
        playing={isPlaying}
        onScoreChange={handleScoreChange}
        onGameOver={handleGameOver}
      />

      {/* HUD — visible during play */}
      <HUD
        score={hud.score}
        level={hud.level}
        visible={isPlaying}
      />

      {/* Overlays — mutually exclusive by phase */}
      {phase === 'wallet' && (
        <WalletGate onReady={handleWalletReady} onViewLeaderboard={handleOpenLB} />
      )}
      {phase === 'paused' && (
        <PauseOverlay
          onResume={() => setPhase('playing')}
          onQuit={handleQuit}
        />
      )}
      {phase === 'over' && (
        <GameOverOverlay
          score={finalScore}
          level={finalLevel}
          onPlayAgain={handlePlayAgain}
          onQuit={handleQuit}
        />
      )}

      {/* Leaderboard — can overlay on top of wallet or over screens */}
      {showLB && <Leaderboard onClose={handleCloseLB} />}
    </>
  );
}
