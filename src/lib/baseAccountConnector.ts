import { createBaseAccountSDK } from '@base-org/account';
import type { ProviderInterface } from '@base-org/account';
import { createConnector } from 'wagmi';
import type { Chain } from 'viem';
import { base } from '../config/chain.js';
import { DATA_SUFFIX } from '../config/wagmi.js';

/**
 * Lazy-initialised Base Account SDK instance. Created once on first connect;
 * `getProvider()` always returns the same EIP-1193 provider (singleton).
 */
let _sdk: ReturnType<typeof createBaseAccountSDK> | null = null;
function getSDK() {
  if (!_sdk) {
    _sdk = createBaseAccountSDK({
      appName: 'Base Frogger DX',
      appLogoUrl: window.location.origin + '/favicon.ico',
      appChainIds: [base.id],
      preference: {
        // ERC-8021 Builder Code attribution — appended natively to initCode
        // and executeBatch calldata by the Smart Wallet (deeper than a simple
        // calldata suffix). This replaces the old per-call dataSuffix approach.
        attribution: {
          dataSuffix: DATA_SUFFIX,
        },
      },
    });
  }
  return _sdk;
}

/**
 * baseAccount — wagmi connector backed by @base-org/account (Base Account SDK).
 *
 * Uses the native Base Account SDK (same as the stable Bomberman integration)
 * instead of the wagmi coinbaseWallet connector which forces the hosted
 * keys.coinbase.com popup that hangs when FingerprintJS is blocked/delayed.
 *
 * The provider is EIP-1193 compliant and emits standard events
 * (accountsChanged, chainChanged, disconnect), so all wagmi hooks work
 * unchanged: useAccount, useConnect, useReadContract, useWriteContract, etc.
 */
export function baseAccount() {
  return createConnector<{ provider: ProviderInterface }>((config) => ({
    id: 'base-account',
    name: 'Base Account',
    icon: 'https://go.wallet.coinbase.com/static/scw-og.png',
    type: 'base-account',

    async connect({ chainId }) {
      const sdk = getSDK();
      const provider = sdk.getProvider();

      // Request accounts — this triggers the Base Account connection flow
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      }) as string[];

      // If a specific chainId is requested and it differs from current, switch
      if (chainId) {
        const currentChainId = await provider.request({
          method: 'eth_chainId',
        }) as string;
        const targetHex = '0x' + chainId.toString(16);
        if (currentChainId !== targetHex) {
          try {
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: targetHex }],
            });
          } catch (switchError: any) {
            // If chain not added (4902), try adding it from our configured chains
            if (switchError?.code === 4902) {
              const chain = config.chains.find(
                (c) => c.id === chainId,
              ) as Chain | undefined;
              if (chain) {
                await provider.request({
                  method: 'wallet_addEthereumChain',
                  params: [
                    {
                      chainId: targetHex,
                      chainName: chain.name,
                      nativeCurrency: chain.nativeCurrency,
                      rpcUrls: chain.rpcUrls,
                      blockExplorerUrls: chain.blockExplorers
                        ? Object.values(chain.blockExplorers).map((e) => e.url)
                        : undefined,
                    },
                  ],
                });
              }
            } else {
              throw switchError;
            }
          }
        }
      }

      // Read the final chainId after any potential switch
      const chainIdHex = (await provider.request({
        method: 'eth_chainId',
      })) as string;
      const connectedChainId = parseInt(chainIdHex, 16);

      // Listen for future account/chain/disconnect events from the provider
      provider.on('accountsChanged', (newAccounts: string[]) => {
        this.onAccountsChanged(newAccounts);
      });
      provider.on('chainChanged', (newChainId: string) => {
        this.onChainChanged(newChainId);
      });
      provider.on('disconnect', () => {
        this.onDisconnect();
      });

      return {
        accounts: accounts as readonly `0x${string}`[],
        chainId: connectedChainId,
      };
    },

    async disconnect() {
      const sdk = getSDK();
      const provider = sdk.getProvider();
      try {
        await provider.disconnect();
      } catch {
        // Some providers don't support disconnect — ignore
      }
    },

    async getAccounts() {
      const sdk = getSDK();
      const provider = sdk.getProvider();
      const accounts = await provider.request({
        method: 'eth_accounts',
      }) as string[];
      return (accounts || []) as readonly `0x${string}`[];
    },

    async getChainId() {
      const sdk = getSDK();
      const provider = sdk.getProvider();
      const chainIdHex = (await provider.request({
        method: 'eth_chainId',
      })) as string;
      return parseInt(chainIdHex, 16);
    },

    async isAuthorized() {
      const sdk = getSDK();
      const provider = sdk.getProvider();
      try {
        const accounts = await provider.request({
          method: 'eth_accounts',
        }) as string[];
        return (accounts?.length ?? 0) > 0;
      } catch {
        return false;
      }
    },

    async getProvider() {
      return getSDK().getProvider();
    },

    onAccountsChanged(accounts) {
      if (accounts.length === 0) {
        config.emitter.emit('disconnect');
      } else {
        config.emitter.emit('change', {
          accounts: accounts as readonly `0x${string}`[],
        });
      }
    },

    onChainChanged(chainId) {
      const id = parseInt(chainId, 16);
      config.emitter.emit('change', { chainId: id });
    },

    onDisconnect() {
      config.emitter.emit('disconnect');
    },
  }));
}
