import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    baseAccount({
      appName: "Base Frogger DX",
    }),
    injected({ target: "braveWallet", unstable_shimAsyncInject: true }),
    injected({ target: "rabby", unstable_shimAsyncInject: true }),
    injected({ unstable_shimAsyncInject: true }),
  ],
  transports: {
    [base.id]: http(),
  },
  multiInjectedProviderDiscovery: true,
});
