"use client";

import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

function short(addr?: string, n = 6) {
  if (!addr) return "-";
  if (addr.length <= n * 2 + 3) return addr;
  return `${addr.slice(0, n)}…${addr.slice(-n)}`;
}

export default function DashboardPage() {
  const { publicKey, connected } = useWallet();
  const wallet = publicKey?.toBase58() || "";

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 960,
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <section>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Dashboard</h1>
        <p style={{ marginTop: 6, opacity: 0.75, lineHeight: 1.6 }}>
          Control panel for identity, reviews, and on-chain operations.
        </p>
      </section>

      {/* Wallet Card */}
      <section
        style={{
          marginTop: 20,
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 16,
          background: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 900 }}>Wallet Connection</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
              Required for admin actions & on-chain writes
            </div>
          </div>

          <WalletMultiButton />
        </div>

        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Status</div>
            <div
              style={{
                marginTop: 6,
                fontSize: 16,
                fontWeight: 900,
                color: connected ? "#166534" : "#991b1b",
              }}
            >
              {connected ? "Connected" : "Not connected"}
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Wallet Address</div>
            <div
              style={{
                marginTop: 6,
                fontFamily: "monospace",
                fontWeight: 900,
                wordBreak: "break-all",
              }}
            >
              {connected ? short(wallet, 10) : "-"}
            </div>
          </div>
        </div>
      </section>

      {/* Next actions / placeholder */}
      <section
        style={{
          marginTop: 20,
          border: "1px dashed #e5e7eb",
          borderRadius: 18,
          padding: 16,
          background: "#fafafa",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 900 }}>Next actions</div>
        <ul style={{ marginTop: 10, paddingLeft: 18, opacity: 0.85, lineHeight: 1.7 }}>
          <li>Review submitted proofs</li>
          <li>Approve & write contributions on-chain</li>
          <li>Manage projects & missions</li>
          <li>Monitor chain sync & receipts</li>
        </ul>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
          This dashboard will evolve into the admin & review control center.
        </div>
      </section>
    </main>
  );
}
