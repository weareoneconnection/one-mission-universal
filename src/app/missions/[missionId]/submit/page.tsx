"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";

type Attachment = { name: string; type: string; size: number; url: string };

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
  const projectId = String(params.projectId);
  const missionId = String(params.missionId);

  // 你现在 mission detail 里应该已有 draft（wallet/signature/message）
  // 这里用 localStorage 取（你可以换成更稳的 store）
  const draft = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(`draft:${projectId}:${missionId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [projectId, missionId]);

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

    // MVP 限制：最多 3 张，每张 <= 300KB（你可调整）
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

    if (!draft?.wallet || !draft?.signature || !draft?.message) {
      setErr("Missing signature draft. Please go back and Sign Message first.");
      return;
    }

    // links 可选，但如果填了必须是合法 URL
    const bad = links.find((u) => !isValidUrl(u));
    if (bad) {
      setErr(`Invalid URL: ${bad}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/proofs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          missionId,
          wallet: draft.wallet,
          signature: draft.signature,
          message: draft.message,
          payload: {
            links,
            note,
            attachments,
          },
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      // 提交成功：清掉 draft（可选）
      localStorage.removeItem(`draft:${projectId}:${missionId}`);

      // 跳去 profile 看 PENDING
      router.push("/profile");
    } catch (e: any) {
      setErr(e?.message || "submit failed");
    } finally {
      setSubmitting(false);
    }
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

        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button
            onClick={() => history.back()}
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
