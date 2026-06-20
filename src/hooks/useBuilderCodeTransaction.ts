import { useCallback, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { encodeFunctionData } from 'viem';
import type { Address, Abi, Hex } from 'viem';
import { getWalletProvider } from '../lib/baseAccountConnector.js';
import { DATA_SUFFIX } from '../config/wagmi.js';

type TxStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

export interface TxError {
  shortMessage?: string;
  message: string;
  code?: number;
}

/**
 * useBuilderCodeTransaction — sends a contract write using RAW eth_sendTransaction
 * against the Base Account EIP-1193 provider (same pattern as Bomberman's
 * payAndStart). It does NOT use wagmi's useWriteContract, because that path
 * makes viem call RPC methods the Base Account provider does not implement
 * (eth_estimateGas, eth_getTransactionCount, simulation) → the
 * "unsupported-method" error from keys.coinbase.com.
 *
 * Builder code (ERC-8021) attribution is appended manually to the calldata as a
 * trailing suffix (contract ignores bytes beyond selector+args), mirroring
 * Bomberman's `calldata + suffix`.
 *
 * Receipt polling is done via the same provider's eth_getTransactionReceipt
 * (a standard read-only RPC) to track confirming → success.
 *
 * https://docs.base.org/apps/builder-codes/builder-codes
 */
export function useBuilderCodeTransaction({
  address,
  abi,
  chainId,
}: {
  address: Address;
  abi: Abi;
  chainId: number;
}) {
  const { address: account } = useAccount();
  const [status, setStatus] = useState<TxStatus>('idle');
  const [hash, setHash] = useState<Hex | undefined>(undefined);
  const [error, setError] = useState<TxError | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const normalizeError = useCallback((e: unknown): TxError => {
    const err = e as { shortMessage?: string; message?: string; code?: number };
    const message = err?.shortMessage || err?.message || 'Transaction failed.';
    return { shortMessage: err?.shortMessage, message, code: err?.code };
  }, []);

  const send = useCallback(
    async (
      functionName: string,
      args: unknown[] = [],
      options?: { value?: bigint },
    ) => {
      stopPolling();
      setStatus('pending');
      setError(null);
      setHash(undefined);

      try {
        const provider = getWalletProvider();
        const from = account;
        if (!from) {
          throw { message: 'Wallet not connected.', shortMessage: 'Wallet not connected.' };
        }

        // 1) Ensure the wallet is on the expected chain (best-effort)
        try {
          const currentChainIdHex = (await provider.request({
            method: 'eth_chainId',
          })) as string;
          const targetHex = '0x' + chainId.toString(16);
          if (currentChainIdHex !== targetHex) {
            try {
              await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: targetHex }],
              });
            } catch (switchError: any) {
              if (switchError?.code !== 4902) throw switchError;
            }
          }
        } catch {
          /* let the tx attempt proceed regardless */
        }

        // 2) Encode calldata: selector + args
        const calldata = encodeFunctionData({ abi, functionName, args });

        // 3) Append ERC-8021 builder code suffix (contract ignores trailing bytes)
        const suffix = DATA_SUFFIX.startsWith('0x')
          ? DATA_SUFFIX.slice(2)
          : DATA_SUFFIX;
        const data = (calldata + suffix) as Hex;

        // 4) Build value as hex (0x0 if none)
        const valueHex = options?.value
          ? (('0x' + options.value.toString(16)) as Hex)
          : '0x0';

        // 5) Send raw transaction to the contract (NOT to self)
        const txHash = (await provider.request({
          method: 'eth_sendTransaction',
          params: [{ from, to: address, value: valueHex, data }],
        })) as Hex;

        setHash(txHash);
        setStatus('confirming');

        // 6) Poll for receipt via standard read-only RPC
        pollRef.current = setInterval(async () => {
          try {
            const receipt = await provider.request({
              method: 'eth_getTransactionReceipt',
              params: [txHash],
            });
            if (!receipt) return; // not mined yet
            const statusHex = (receipt as { status?: string }).status;
            stopPolling();
            if (statusHex === '0x1') {
              setStatus('success');
            } else {
              setError({
                message: 'Transaction reverted onchain.',
                shortMessage: 'Transaction reverted onchain.',
              });
              setStatus('error');
            }
          } catch {
            /* keep polling on transient RPC errors */
          }
        }, 2500);
      } catch (e) {
        stopPolling();
        setError(normalizeError(e));
        setStatus('error');
      }
    },
    [abi, address, chainId, account, normalizeError, stopPolling],
  );

  return { send, status, hash, error };
}
