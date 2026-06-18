import { useState, useCallback, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { FROGGER_LEADERBOARD_ADDRESS } from '../config/wagmi.js';
import { base } from '../config/chain.js';
import FROGGER_ABI from '../abi/FroggerLeaderboard.json';
import { useBuilderCodeTransaction } from '../hooks/useBuilderCodeTransaction.js';
import { useMiniApp } from '../hooks/useMiniApp.js';
import { saveLocalScore } from '../lib/onchain.js';

/**
 * Game Over overlay — shows final score, submit onchain, share, and play again.
 *
 * Score submission uses `useBuilderCodeTransaction` (useWriteContract +
 * per-call dataSuffix) so the ERC-8021 builder code suffix is appended to the
 * calldata for any wallet (Smart Wallet, MetaMask, EOA).
 */
export default function GameOverOverlay({
  score = 0,
  level = 1,
  onPlayAgain,
  onQuit,
}: {
  score?: number;
  level?: number;
  onPlayAgain: () => void;
  onQuit: () => void;
}) {
  const [status, setStatus] = useState('');
  const { composeCast } = useMiniApp();

  const { send, status: txStatus, error } = useBuilderCodeTransaction({
    address: FROGGER_LEADERBOARD_ADDRESS,
    abi: FROGGER_ABI,
    chainId: base.id,
  });

  // Read submitFee from contract to attach as msg.value
  const { data: submitFee } = useReadContract({
    address: FROGGER_LEADERBOARD_ADDRESS,
    abi: FROGGER_ABI,
    functionName: 'submitFee',
    chainId: base.id,
  });

  const handleSubmit = useCallback(() => {
    setStatus('Submitting score...');
    // submitScore(string name, uint32 score, uint16 level) — builder code suffix attached via the hook
    send('submitScore', ['Player', BigInt(score), level], {
      value: submitFee ?? BigInt(0),
    });
  }, [score, level, send, submitFee]);

  // React to tx states inside an effect to avoid setState-during-render warnings.
  useEffect(() => {
    if (txStatus === 'error') {
      const msg = error?.shortMessage || error?.message || 'Transaction failed. Try again.';
      setStatus('⚠ ' + msg);
    } else if (txStatus === 'success') setStatus('✅ Score submitted onchain!');
    else if (txStatus === 'confirming') setStatus('⏳ Waiting for confirmation...');
    else if (txStatus === 'pending') setStatus('⏳ Transaction pending...');
  }, [txStatus, error]);

  // Save locally on mount
  useEffect(() => {
    saveLocalScore('Player', score, level);
  }, [score, level]);

  // Share
  async function handleShare() {
    const text = `🐸 I scored ${score} in Base Frogger DX on level ${level}! Can you beat me?`;
    try {
      await composeCast(text, [window.location.href]);
    } catch {
      setStatus('Copied to clipboard!');
    }
  }

  return (
    <div className="overlay" data-overlay>
      <div className="panel" role="dialog" aria-modal="true">
        <h1>GAME OVER</h1>
        <h2>SCORE: {score} · LVL: {level}</h2>
        <p id="submitStatus" className="small">{status}</p>
        <button onClick={handleSubmit} disabled={txStatus === 'pending' || txStatus === 'confirming'}>
          🔗 SUBMIT ONCHAIN
        </button>
        <button className="alt" onClick={handleShare}>📢 SHARE</button>
        <button onClick={onPlayAgain}>🐸 PLAY AGAIN</button>
        <button className="alt" onClick={onQuit}>🏠 QUIT</button>
      </div>
    </div>
  );
}
