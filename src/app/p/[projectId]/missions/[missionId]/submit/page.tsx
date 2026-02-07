"use client";

import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

type Attachment = { name: string; type: string; size: number; url: string };

type ProofDraft = {
  version: 1;
  missionId: string;
  projectId: string;
  wallet: string;
  proofType: "SIGN_MESSAGE";
  message: string;
  signature: string; // base58
  nonce: string;
  issuedAt: number;
  domain: string;
};

function draftKey(projectId: string, missionId: string, wallet: string) {
  return `proof_draft:v1:${projectId}:${missionId}:${wallet}`;
}

function loadDraft(projectId: string, missionId: string, wallet: string): ProofDraft | null {
  if (!projectId || !missionId || !wallet) return null;
  try {
    const raw = localStorage.getItem(draftKey(projectId, missionId, wallet));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.missionId || !obj?.wallet || !obj?.projectId) return null;
    return obj as ProofDraft;
  } catch {
    return null;
  }
}

function isValidUrl(s: string) {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("read file failed"));
    r.readAsDataURL(file);
  });
}

export default function SubmitProofPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string; missionId: string }>();
  const projectId = String(params?.projectId || "");
  const missionId = String(params?.missionId || "");

  const { publicKey, connected } = useWallet();
  const walletStr = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  const draft = useMemo(() => {
    if (typeof window === "undefined") return null;
    if (!projectId || !missionId || !walletStr) return null;
    return loadDraft(projectId, missionId, walletStr);
  }, [projectId, missionId, walletStr]);

  const [linksText, setLinksText] = useState("");
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const links = useMemo(() => {
    return linksText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [linksText]);

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setErr(null);

    // MVP 限制：最多 3 张，每张 <= 300KB
    const next: Attachment[] = [];
    for (const f of files.slice(0, 3)) {
      if (f.size > 300 * 1024) {
        setErr(`Image too large: ${f.name} (>300KB). Please use a smaller screenshot.`);
        continue;
      }
      const url = await fileToDataUrl(f);
      next.push({ name: f.name, type: f.type, size: f.size, url });
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 3));
    e.target.value = "";
  }

  async function submit() {
    setErr(null);

    if (!connected || !walletStr) {
      setErr("Wallet not connected.");
      return;
    }

    if (!draft?.signature || !draft?.message) {
      setErr("Missing signature draft. Please go back and Sign Message first.");
      return;
    }

    // ✅ 额外校验：确保 draft 属于当前 route 的 project/mission
    if (draft.projectId !== projectId || draft.missionId !== missionId) {
      setErr("Draft mismatch (project/mission). Please go back and re-sign.");
      return;
    }

    const bad = links.find((u) => !isValidUrl(u));
    if (bad) {
      setErr(`Invalid URL: ${bad}`);
      return;
    }

    setSubmitting(true);
    try {
      // ✅ 项目隔离：提交必须走 /api/projects/[projectId]/proofs
      // ✅ 后端从 header 读钱包：必须带 x-wallet
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/proofs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet": walletStr, // ✅ 关键：必须带
        },
        body: JSON.stringify({
          missionId: missionId,
          proofType: draft.proofType,
          message: draft.message,
          signature: draft.signature,
          issuedAt: draft.issuedAt,
          payload: {
            links, // ✅ 用你输入的 links
            note,  // ✅ 用你输入的 note
            attachments, // ✅ 你选的图片（dataURL MVP）
          },
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        const msg =
          data?.error === "UNAUTHORIZED"
            ? "Unauthorized (missing x-wallet header)."
            : data?.error === "INVALID_SIGNATURE"
            ? "Invalid signature (verification failed)."
            : data?.error === "VALIDATION_ERROR"
            ? `Validation error: ${data?.message || "check payload"}`
            : data?.error || data?.message || `Submit failed (${res.status})`;
        throw new Error(msg);
      }

      // 成功后去 profile 看 PENDING
      router.push("/profile");
    } catch (e: any) {
      setErr(e?.message || "submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!projectId || !missionId) {
    return (
      <main style={{ padding: 24, maxWidth: 920, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Missing params</h1>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 920, margin: "32px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Submit Proof</h1>
      <div style={{ marginTop: 6, opacity: 0.7 }}>
        Project: <code>{projectId}</code> · Mission: <code>{missionId}</code>
      </div>

      <section style={{ marginTop: 18, border: "1px solid #eee", borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Links (one per line)</div>
        <textarea
          value={linksText}
          onChange={(e) => setLinksText(e.target.value)}
          rows={4}
          placeholder={"https://x.com/... \nhttps://github.com/..."}
          style={{ width: "100%", border: "1px solid #ddd", borderRadius: 10, padding: 12 }}
        />

        <div style={{ fontWeight: 700, marginTop: 14, marginBottom: 8 }}>Note</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder={"Describe what you did, how to verify, and any context for reviewers."}
          style={{ width: "100%", border: "1px solid #ddd", borderRadius: 10, padding: 12 }}
        />

        <div style={{ fontWeight: 700, marginTop: 14, marginBottom: 8 }}>Images (optional)</div>
        <input type="file" accept="image/*" multiple onChange={onPickFiles} />
        {attachments.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {attachments.map((a, i) => (
              <div key={i} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{a.name}</div>
                <img src={a.url} alt={a.name} style={{ width: 220, borderRadius: 10, marginTop: 8 }} />
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12, opacity: 0.8, fontSize: 13 }}>
          Signature draft:{" "}
          {draft?.signature ? (
            <span style={{ color: "#16a34a", fontWeight: 800 }}>ready</span>
          ) : (
            <span style={{ color: "#b91c1c", fontWeight: 800 }}>missing</span>
          )}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button
            onClick={() => router.push(`/p/${projectId}/missions/${missionId}`)}
            style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", background: "white" }}
          >
            Back
          </button>
          <button
            disabled={submitting}
            onClick={submit}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: submitting ? "#ddd" : "#111",
              color: "white",
              fontWeight: 700,
            }}
          >
            {submitting ? "Submitting..." : "Submit (Pending Approval)"}
          </button>
        </div>

        {err && <div style={{ marginTop: 12, color: "#b00020", fontWeight: 600 }}>{err}</div>}
      </section>

      <section style={{ marginTop: 14, opacity: 0.75 }}>
        After submission, your proof will be <b>PENDING</b> until the project admin approves/rejects it.
      </section>
    </main>
  );
}
