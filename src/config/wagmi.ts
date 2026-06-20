import { http, createConfig, createStorage } from 'wagmi';
import { Attribution } from 'ox/erc8021';
import { base } from './chain.js';
import { baseAccount } from '../lib/baseAccountConnector.js';

// Deployed on Base Mainnet via Remix IDE / Foundry
export const FROGGER_LEADERBOARD_ADDRESS =
  '0x72B8425C4bdd01e745accEA7A07B5DF789672cd5' as const;

// Base Builder Code (ERC-8021) — data suffix consumed by the Base Account SDK
// to attribute onchain activity to this app. The SDK appends it natively to
// initCode and executeBatch calldata (deeper than a calldata suffix).
// https://docs.base.org/apps/builder-codes/builder-codes
//
// Generated with the official `ox` ERC-8021 module (no hardcoded hex).
export const DATA_SUFFIX = Attribution.toDataSuffix({ codes: ['bc_71rtn7uh'] });

export const wagmiConfig = createConfig({
  chains: [base], // mainnet-only
  connectors: [
    // Base Account SDK (native Smart Wallet — stable, no keys.coinbase.com popup)
    baseAccount(),
  ],
  transports: {
    [base.id]: http(),
  },
  // Vite SPA — no server-side rendering.
  ssr: false,
  storage: createStorage({ storage: typeof window !== 'undefined' ? window.localStorage : undefined }),
});
