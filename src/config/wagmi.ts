import { http, createConfig, createStorage } from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors';
import { Attribution } from 'ox/erc8021';
import { base } from './chain.js';

// Deployed on Base Mainnet via Remix IDE / Foundry
export const FROGGER_LEADERBOARD_ADDRESS =
  '0x72B8425C4bdd01e745accEA7A07B5DF789672cd5' as const;

// Base Builder Code (ERC-8021) — calldata suffix appended to every transaction
// so the Base indexer attributes onchain activity to this app.
// https://docs.base.org/apps/builder-codes/builder-codes
//
// Generated with the official `ox` ERC-8021 module (no hardcoded hex).
export const DATA_SUFFIX = Attribution.toDataSuffix({ codes: ['bc_71rtn7uh'] });

export const wagmiConfig = createConfig({
  chains: [base], // mainnet-only
  connectors: [
    // Coinbase Smart Wallet (passkey-based, no extension required)
    coinbaseWallet({
      preference: 'smartWalletOnly',
      appName: 'Base Frogger DX',
    }),
  ],
  transports: {
    [base.id]: http(),
  },
  // Vite SPA — no server-side rendering.
  ssr: false,
  storage: createStorage({ storage: typeof window !== 'undefined' ? window.localStorage : undefined }),
  // Appends the builder code suffix to public client calls (estimateGas, etc.)
  // and to sendTransaction calls that resolve via this config's own client.
  dataSuffix: DATA_SUFFIX,
});
