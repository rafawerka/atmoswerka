"use client";

import { useMemo, type ReactNode } from "react";
import type { Adapter } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { Buffer } from "buffer";

import "@solana/wallet-adapter-react-ui/styles.css";

if (typeof window !== "undefined") {
  window.Buffer = window.Buffer ?? Buffer;
}

declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}

/**
 * Providers da carteira Solana (Wallet Standard) na Devnet.
 */
export function SolanaProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);
  const wallets = useMemo<Adapter[]>(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
