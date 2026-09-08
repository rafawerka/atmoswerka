"use client";

import dynamic from "next/dynamic";

const LABELS = {
  "change-wallet": "Trocar carteira",
  connecting: "Conectando...",
  "copy-address": "Copiar endereço",
  copied: "Copiado",
  disconnect: "Desconectar",
  "has-wallet": "Carteira Devnet",
  "no-wallet": "Conectar Carteira",
};

/** Botão de conexão de carteira, carregado só no cliente. */
export const WalletButton = dynamic(
  async () => {
    const { BaseWalletMultiButton } = await import("@solana/wallet-adapter-react-ui");

    return function WalletButtonInner() {
      return <BaseWalletMultiButton labels={LABELS} />;
    };
  },
  {
    ssr: false,
    loading: () => (
      <div className="h-10 w-40 animate-pulse rounded-lg bg-violet-200/80 dark:bg-violet-950" />
    ),
  },
);
