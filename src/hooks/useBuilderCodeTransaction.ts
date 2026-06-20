import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import type { Address, Abi } from 'viem';

/**
 * useBuilderCodeTransaction — sends a contract write via wagmi's useWriteContract.
 *
 * ERC-8021 builder code attribution is handled natively by the Base Account SDK
 * (configured in `baseAccountConnector.ts` via `preference.attribution.dataSuffix`).
 * The SDK appends the builder code to initCode and executeBatch calldata — deeper
 * and more reliable than a per-call calldata suffix.
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
  const {
    writeContractAsync,
    data: hash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const send = useCallback(
    async (
      functionName: string,
      args: unknown[] = [],
      options?: { value?: bigint },
    ) => {
      reset();
      try {
        await writeContractAsync({
          address,
          abi,
          functionName,
          args,
          chainId,
          // Send ETH value (for payable functions like recordPlay/submitScore)
          value: options?.value,
        });
      } catch {
        // Error state is exposed via `writeError` from useWriteContract.
      }
    },
    [address, abi, chainId, writeContractAsync, reset],
  );

  // Map the write lifecycle onto a simple status for the UI.
  let status: 'idle' | 'pending' | 'confirming' | 'success' | 'error' = 'idle';
  if (writeError) status = 'error';
  else if (isSuccess) status = 'success';
  else if (isConfirming) status = 'confirming';
  else if (isPending) status = 'pending';
  else if (hash) status = 'confirming';

  return { send, status, hash, error: writeError };
}
