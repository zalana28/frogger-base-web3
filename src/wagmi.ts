import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";

function getRabbyProvider() {
  if (typeof window === "undefined") return;
  const ethereum = (window as typeof window & { ethereum?: any }).ethereum;
  if (!ethereum) return;

  if (Array.isArray(ethereum.providers)) {
    return ethereum.providers.find((provider: any) => provider?.isRabby);
  }

  if (ethereum.isRabby) return ethereum;
}

function getBraveProvider() {
  if (typeof window === "undefined") return;
  const ethereum = (window as typeof window & { ethereum?: any }).ethereum;
  if (!ethereum) return;

  if (Array.isArray(ethereum.providers)) {
    return ethereum.providers.find((provider: any) => provider?.isBraveWallet);
  }

  if (ethereum.isBraveWallet) return ethereum;
}

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    baseAccount({
      appName: "Base Frogger DX",
    }),
    injected({
      target: {
        id: "rabby",
        name: "Rabby Wallet",
        provider: getRabbyProvider,
      },
      unstable_shimAsyncInject: true,
    }),
    injected({
      target: {
        id: "brave",
        name: "Brave Wallet",
        provider: getBraveProvider,
      },
      unstable_shimAsyncInject: true,
    }),
    injected({ unstable_shimAsyncInject: true }),
  ],
  transports: {
    [base.id]: http(),
  },
  multiInjectedProviderDiscovery: true,
});
