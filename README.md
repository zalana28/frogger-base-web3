# Base Frogger Web3 Mini Game

A simple Frogger-style arcade game built with **React + TypeScript + Vite + Canvas**, gated by an onchain transaction on **Base**.

Connect a wallet on Base, pay the `entryFee` to call `startGame()`, and gameplay
begins only after the transaction confirms. Your score is submitted onchain via
`submitScore()` after each game over (when a wallet is connected and on Base).

## Tech stack

- React 18 + TypeScript + Vite
- wagmi + viem for wallet / contract interaction
- `@base-org/account` (Sign in with Base) + injected wallets
- HTML Canvas for rendering
- Builder Code attribution: `base:app_id` meta tag (`index.html`) + tx `dataSuffix`

## Commands

```bash
npm install      # install dependencies
npm run dev      # start the Vite dev server (local manual testing)
npm run build    # type-check (tsc -b) + production build to dist/
npm run preview  # preview the production build locally
```

Deploy `dist/` on Vercel (framework preset: **Vite**, build command `npm run build`,
output directory `dist`).

## Network

This app targets **Base mainnet** (chain id `8453`). If your wallet is on any other
network the app shows a "Switch your wallet to Base" warning and disables **Pay & Start**.

## Contract

- ABI and address live in [`src/contracts/froggerGame.ts`](src/contracts/froggerGame.ts)
  (`FROGGER_GAME_ADDRESS` / `FROGGER_GAME_ABI`).
- The `FroggerGame` contract exposes `entryFee()` (view), `startGame()` (payable),
  and `submitScore(uint256)`.
- The RPC transport is the default Base public RPC (`http()` in `src/wagmi.ts`).
  Swap in a dedicated RPC URL there if you hit public-RPC rate limits.

## Wallet testing checklist

- [ ] **Not connected** → HUD shows "Not connected" and a "Connect wallet to begin." status.
- [ ] **Connect with Sign in with Base** → connects and shows a truncated address.
- [ ] **Connect with a browser injected wallet** (MetaMask / Rabby / Brave) → connects;
      unavailable connectors appear as "Not detected" and are disabled rather than crashing.
- [ ] **Wrong network** → "Wrong network. Switch your wallet to Base." warning; Pay & Start disabled.
- [ ] **On Base, entry fee loaded** → HUD shows the entry fee; Pay & Start is enabled.
- [ ] **Pay & Start** → one wallet prompt; button shows "Pending..."; rapid double-clicks do **not**
      create a second transaction; the startGame tx hash (Basescan link) appears.
- [ ] **Confirmation** → gameplay begins only after the receipt confirms.
- [ ] **Rejected / failed tx** → friendly retry message; pending state clears so you can retry.
- [ ] **Game over while connected on Base** → a single `submitScore` transaction fires
      (no duplicate prompts); its tx hash appears.
- [ ] **Leaderboard** persists across reloads (localStorage).
- [ ] **Controls** work via keyboard (arrows / WASD) and the on-screen arcade buttons (mobile).

## Notes

- The local leaderboard uses `localStorage` only — there is no backend or database.
- Builder Code attribution (`base:app_id` + `dataSuffix`) is preserved on both contract calls.
