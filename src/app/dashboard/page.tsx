"use client";

import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function DashboardPage() {
  const { publicKey, connected } = useWallet();

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Dashboard</h1>

      <div style={{ marginTop: 16 }}>
        <WalletMultiButton />
      </div>

      <div style={{ marginTop: 16 }}>
        <p>
          Status: <b>{connected ? "Connected" : "Not connected"}</b>
        </p>
        <p>
          Wallet: <b>{publicKey?.toBase58() || "-"}</b>
        </p>
      </div>
    </main>
  );
}
