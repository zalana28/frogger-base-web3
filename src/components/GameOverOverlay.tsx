import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount, useReadContract } from 'wagmi';
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
 *
 * submitScore() requires an active game session onchain (set by recordPlay()
 * and consumed on each submit). We pre-flight that with hasActiveGame(address)
 * so a revert ("No active game") surfaces as a friendly status line instead of
 * a wallet "insufficient funds" error from a failed gas simulation.
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
  const { address, isConnected } = useAccount();

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

  // Pre-flight: is there an unconsumed game session onchain? submitScore()
  // requires activeGameStartedAt[player] > 0, else it reverts "No active game".
  const { data: activeGame, isLoading: activeGameLoading } = useReadContract({
    address: FROGGER_LEADERBOARD_ADDRESS,
    abi: FROGGER_ABI,
    functionName: 'hasActiveGame',
    args: address ? [address] : undefined,
    chainId: base.id,
    query: { enabled: !!address },
  });

  const hasActiveGame = activeGame === true;
  const txBusy = txStatus === 'pending' || txStatus === 'confirming';
  // Submit is only safe when connected, the pre-flight read has resolved, and an
  // active game session exists. Otherwise it would revert in gas simulation and
  // the wallet would surface a misleading "insufficient funds" message.
  const canSubmit = isConnected && hasActiveGame && !txBusy;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return; // guard against stale taps while unsafe
    setStatus('Submitting score...');
    // submitScore(string name, uint32 score, uint16 level) — builder code suffix attached via the hook
    send('submitScore', ['Player', BigInt(score), level], {
      value: submitFee ?? BigInt(0),
    });
  }, [score, level, send, submitFee, canSubmit]);

  // Translate raw wagmi/viem errors into user-friendly status lines. A reverted
  // submitScore is reported by smart wallets as "insufficient funds / error
  // generating transaction" — we surface the real cause instead.
  const friendlyError = useCallback((err: unknown): string => {
    const msg = (err && (err as { shortMessage?: string; message?: string }).shortMessage) ||
      (err && (err as { message?: string }).message) || '';
    const lower = String(msg).toLowerCase();
    if (lower.includes('no active game')) {
      return 'No active game session. Play again to start a new session before submitting.';
    }
    if (lower.includes('insufficient') || lower.includes('funds')) {
      return 'Transaction reverted during simulation. Start a new game before submitting.';
    }
    if (lower.includes('invalid name')) return 'Invalid player name.';
    if (lower.includes('score too high')) return 'Score exceeds the onchain limit.';
    return String(msg) || 'Transaction failed. Try again.';
  }, []);

  // React to tx states inside an effect to avoid setState-during-render warnings.
  useEffect(() => {
    if (txStatus === 'error') {
      setStatus('⚠ ' + friendlyError(error));
    } else if (txStatus === 'success') setStatus('✅ Score submitted onchain!');
    else if (txStatus === 'confirming') setStatus('⏳ Waiting for confirmation...');
    else if (txStatus === 'pending') setStatus('⏳ Transaction pending...');
  }, [txStatus, error, friendlyError]);

  // Surface the pre-flight result as a status line when submit is not possible.
  useEffect(() => {
    if (isConnected && !txBusy && txStatus !== 'success') {
      if (activeGameLoading) setStatus('Checking game session...');
      else if (!hasActiveGame) {
        setStatus('⚠ No active game session. Play again to submit a new score.');
      } else if (txStatus === 'idle') setStatus('');
      // else: keep the tx-driven status line
    }
  }, [isConnected, hasActiveGame, activeGameLoading, txBusy, txStatus]);

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

  // Explain why the submit button is disabled, for the aria-label.
  const submitDisabledReason = useMemo(() => {
    if (!isConnected) return 'Wallet not connected';
    if (activeGameLoading) return 'Checking game session';
    if (!hasActiveGame) return 'No active game session — play again first';
    if (txBusy) return 'Transaction in progress';
    return null;
  }, [isConnected, activeGameLoading, hasActiveGame, txBusy]);

  return (
    <div className="overlay" data-overlay>
      <div className="panel" role="dialog" aria-modal="true">
        <h1>GAME OVER</h1>
        <h2>SCORE: {score} · LVL: {level}</h2>
        <p id="submitStatus" className="small">{status}</p>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-disabled={!canSubmit}
          aria-label={submitDisabledReason ? `SUBMIT ONCHAIN (disabled: ${submitDisabledReason})` : 'SUBMIT ONCHAIN'}
        >
          🔗 SUBMIT ONCHAIN
        </button>
        <button className="alt" onClick={handleShare}>📢 SHARE</button>
        <button onClick={onPlayAgain}>🐸 PLAY AGAIN</button>
        <button className="alt" onClick={onQuit}>🏠 QUIT</button>
      </div>
    </div>
  );
}
