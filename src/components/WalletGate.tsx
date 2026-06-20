import { useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain, useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import { FROGGER_LEADERBOARD_ADDRESS } from '../config/wagmi.js';
import { base } from '../config/chain.js';
import FROGGER_ABI from '../abi/FroggerLeaderboard.json';
import { useBuilderCodeTransaction } from '../hooks/useBuilderCodeTransaction.js';

/**
 * WalletGate — full-screen overlay shown BEFORE the player can start the game.
 *
 * Flow:
 * 1. Show "Connect Wallet" button (Coinbase Smart Wallet)
 * 2. After connect: ensure Base chain
 * 3. Player clicks "Enter Game & Play" → sends recordPlay() tx with the
 *    ERC-8021 builder code suffix appended to calldata (payable with playFee)
 * 4. Wait for tx confirmation → callback onReady()
 */
export default function WalletGate({
  onReady,
  onViewLeaderboard,
  onCancel,
}: {
  onReady: () => void;
  onViewLeaderboard?: () => void;
  /** When set, this gate is re-arming a game session (Play Again path). */
  onCancel?: () => void;
}) {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const { send, status, hash, error } = useBuilderCodeTransaction({
    address: FROGGER_LEADERBOARD_ADDRESS,
    abi: FROGGER_ABI,
    chainId: base.id,
  });

  const isPending = status === 'pending';
  const isConfirming = status === 'confirming';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  // Read playFee from contract
  const { data: playFee } = useReadContract({
    address: FROGGER_LEADERBOARD_ADDRESS,
    abi: FROGGER_ABI,
    functionName: 'playFee',
    chainId: base.id,
    query: { enabled: isConnected },
  });

  // Once the call settles successfully, unlock the game.
  useEffect(() => {
    if (isSuccess) onReady();
  }, [isSuccess, onReady]);

  function handleConnect(connectorId: string) {
    const c = connectors.find((c) => c.id === connectorId);
    if (c) {
      connect(
        { connector: c },
        {
          onSuccess: () => {
            try { switchChain({ chainId: base.id }); } catch { /* may already be on Base */ }
          },
        },
      );
    }
  }

  function handleEnterGame() {
    // recordPlay() — ERC-8021 builder code suffix attached via the hook
    send('recordPlay', [], {
      value: playFee ?? BigInt(0),
    });
  }

  return (
    <div className="overlay">
      <div className="panel">
        <h1>BASE FROGGER DX</h1>
        <h2>🐸 CONNECT WALLET 🐸</h2>

        {!isConnected ? (
          <>
            <p>Connect your wallet on Base network to start playing.</p>
            <p className="small">
              Coinbase Smart Wallet uses passkeys — no extension needed.
            </p>

            {connectors.map((c) => (
              <button
                key={c.id}
                onClick={() => handleConnect(c.id)}
                disabled={isConnecting}
              >
                {isConnecting ? '⏳ Connecting...' : `🔗 ${c.name}`}
              </button>
            ))}

            {onViewLeaderboard && (
              <button className="alt" onClick={onViewLeaderboard}>
                🏆 LEADERBOARD
              </button>
            )}
          </>
        ) : (
          <>
            <div className="wallet-status">
              <span className="dot connected" />
              <span>Connected</span>
            </div>
            <p className="address">{address}</p>
            <p className="small">
              Connected via {connector?.name}
              {playFee !== undefined && (
                <> &middot; Play fee: {formatEther(playFee)} ETH</>
              )}
            </p>

            {!hash && !isPending && !isConfirming && !isError && (
              <>
                <p>
                  {onCancel
                    ? 'Start a new game session on Base to play again and submit a new score.'
                    : 'Click below to enter the game and pay the play fee on Base.'}
                </p>
                <button className="warn" onClick={handleEnterGame}>
                  {onCancel ? '🐸 PLAY AGAIN' : '🐸 ENTER GAME & PLAY'}
                </button>
                {onCancel ? (
                  <button className="alt" onClick={onCancel}>
                    CANCEL
                  </button>
                ) : (
                  <button className="alt" onClick={() => disconnect()}>
                    DISCONNECT
                  </button>
                )}
              </>
            )}

            {isPending && (
              <div className="tx-status">
                ⏳ Transaction pending... Confirm in your wallet.
              </div>
            )}

            {isConfirming && (
              <div className="tx-status">
                ⏳ Waiting for confirmation...
                {hash && (
                  <p className="small">
                    TX: <a href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{hash.slice(0, 10)}...</a>
                  </p>
                )}
              </div>
            )}

            {isSuccess && (
              <div className="tx-status" style={{ borderColor: '#00ff7f' }}>
                ✅ Game entry confirmed! Starting...
              </div>
            )}

            {isError && (
              <div className="tx-status" style={{ borderColor: 'var(--danger)' }}>
                ⚠ {error?.shortMessage || error?.message || 'Transaction failed. Try again.'}
                <br />
                <button className="alt" onClick={handleEnterGame} style={{ marginTop: 8, maxWidth: 200 }}>
                  RETRY
                </button>
                {onCancel && (
                  <button className="alt" onClick={onCancel} style={{ marginTop: 8, maxWidth: 200, marginLeft: 8 }}>
                    CANCEL
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
