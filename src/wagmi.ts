import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    baseAccount({
      appName: "Base Frogger DX",
      preference: {
        options: "smartWalletOnly",
      },
    }),
    injected({ target: "braveWallet" }),
    injected({ target: "rabby" }),
    injected(),
  ],
  transports: {
    [base.id]: http(),
  },
});
