import { createBaseAccountSDK } from '@base-org/account';
import type { ProviderInterface } from '@base-org/account';
import { createConnector } from 'wagmi';
import type { Chain } from 'viem';
import { base } from '../config/chain.js';

/**
 * Lazy-initialised Base Account SDK instance (singleton). Mirrors the working
 * Bomberman setup exactly: createBaseAccountSDK({ appName, appLogoUrl, appChainIds }).
 */
let _sdk: ReturnType<typeof createBaseAccountSDK> | null = null;
function getSDK() {
  if (!_sdk) {
    _sdk = createBaseAccountSDK({
      appName: 'Base Frogger DX',
      appLogoUrl: window.location.origin + '/favicon.ico',
      appChainIds: [base.id],
    });
  }
  return _sdk;
}

/**
 * Direct access to the Base Account EIP-1193 provider — used by
 * useBuilderCodeTransaction to send raw eth_sendTransaction calls (same pattern
 * as Bomberman's payAndStart). This avoids the wagmi/viem RPC methods that the
 * Base Account provider does NOT implement (eth_estimateGas, simulation, etc.),
 * which caused the "unsupported-method" error from keys.coinbase.com.
 */
export function getWalletProvider(): ProviderInterface {
  return getSDK().getProvider();
}

/**
 * baseAccount — wagmi connector for connection + onchain reads (via wagmi's own
 * HTTP public client). Contract WRITES must go through getWalletProvider() +
 * raw eth_sendTransaction (see useBuilderCodeTransaction), NOT through wagmi
 * useWriteContract — that path triggers unsupported RPC methods on the Base
 * Account provider.
 */
export function baseAccount() {
  return createConnector<{ provider: ProviderInterface }>((config) => ({
    id: 'base-account',
    name: 'Base Account',
    icon: 'https://go.wallet.coinbase.com/static/scw-og.png',
    type: 'base-account',

    async connect({ chainId }) {
      const provider = getWalletProvider();

      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      }) as string[];

      if (chainId) {
        const currentChainId = (await provider.request({
          method: 'eth_chainId',
        })) as string;
        const targetHex = '0x' + chainId.toString(16);
        if (currentChainId !== targetHex) {
          try {
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: targetHex }],
            });
          } catch (switchError: any) {
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

      const chainIdHex = (await provider.request({
        method: 'eth_chainId',
      })) as string;
      const connectedChainId = parseInt(chainIdHex, 16);

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
      try {
        await getWalletProvider().disconnect();
      } catch {
        /* some providers don't support disconnect */
      }
    },

    async getAccounts() {
      const accounts = (await getWalletProvider().request({
        method: 'eth_accounts',
      })) as string[];
      return (accounts || []) as readonly `0x${string}`[];
    },

    async getChainId() {
      const chainIdHex = (await getWalletProvider().request({
        method: 'eth_chainId',
      })) as string;
      return parseInt(chainIdHex, 16);
    },

    async isAuthorized() {
      try {
        const accounts = (await getWalletProvider().request({
          method: 'eth_accounts',
        })) as string[];
        return (accounts?.length ?? 0) > 0;
      } catch {
        return false;
      }
    },

    async getProvider() {
      return getWalletProvider();
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
      config.emitter.emit('change', { chainId: parseInt(chainId, 16) });
    },

    onDisconnect() {
      config.emitter.emit('disconnect');
    },
  }));
}
