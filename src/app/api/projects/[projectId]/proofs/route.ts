import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getHeaderWallet } from "@/lib/server/auth";
import {
  listProofsByProject,
  listProofsByProjectAndStatus,
  createProof,
  saveProof,
} from "@/lib/proof-store";
import { verifySignedMessageProof } from "@/lib/proofs/verify";
import type { Proof } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = {
  params: Promise<{
    projectId: string;
  }>;
};

/** -------------------------
 * projectId 兜底解析
 * 1) ctx.params.projectId
 * 2) URL path: /api/projects/:projectId/proofs
 * 3) body.projectId (可选兜底)
 ------------------------- */
function getProjectIdFromReq(req: NextRequest, ctx?: { params?: { projectId?: string } }, body?: any) {
  // 1) Next 注入 params
  const fromParams = String(ctx?.params?.projectId || "").trim();
  if (fromParams) return fromParams;

  // 2) 从 URL 解析
  try {
    const pathname = new URL(req.url).pathname; // e.g. /api/projects/proj_xxx/proofs
    const parts = pathname.split("/").filter(Boolean); // ["api","projects","proj_xxx","proofs"]
    const i = parts.indexOf("projects");
    const fromPath = i >= 0 ? String(parts[i + 1] || "").trim() : "";
    if (fromPath) return fromPath;
  } catch {
    // ignore
  }

  // 3) body 兜底（可选）
  const fromBody = String(body?.projectId || "").trim();
  if (fromBody) return fromBody;

  return "";
}

/* =========================
   GET /api/projects/:projectId/proofs
   ?status=PENDING|APPROVED|REJECTED|REVOKED
========================= */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { projectId: p } = await ctx.params;
    const projectId = getProjectIdFromReq(req, { params: { projectId: p } });
    if (!projectId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_PROJECT_ID" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const status = statusParam?.toUpperCase() as
      | Proof["currentStatus"]
      | undefined;

    const VALID_STATUS: Proof["currentStatus"][] = [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "REVOKED",
    ];

    const proofs =
      status && VALID_STATUS.includes(status)
        ? await listProofsByProjectAndStatus(projectId, status)
        : await listProofsByProject(projectId);

    return NextResponse.json({ ok: true, proofs });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

/* =========================
   POST /api/projects/:projectId/proofs
   提交 Proof（用户）
========================= */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    /* -------------------------
       1️⃣ 钱包鉴权
    ------------------------- */
    const wallet = getHeaderWallet(req);
    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    /* -------------------------
       2️⃣ 读取 body
    ------------------------- */
    const body = await req.json().catch(() => ({}));

    const { projectId: p } = await ctx.params;
    const projectId = getProjectIdFromReq(req, { params: { projectId: p } }, body);
    if (!projectId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_PROJECT_ID" },
        { status: 400 }
      );
    }

    const missionId = String(body.missionId || "").trim();
    const message = String(body.message || "").trim();
    const signature = String(body.signature || "").trim();
    const payload = body.payload;

    if (!missionId || !message || !signature) {
      return NextResponse.json(
        {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "missionId / message / signature required",
        },
        { status: 400 }
      );
    }

    /* -------------------------
       3️⃣ 校验签名
    ------------------------- */
    const ok = await verifySignedMessageProof({
      wallet,
      message,
      signature,
      expectProjectId: projectId,
      expectMissionId: missionId,
    });

    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "INVALID_SIGNATURE" },
        { status: 400 }
      );
    }

    /* -------------------------
       4️⃣ 创建 Proof（统一入口）
    ------------------------- */
    const proof = await createProof({
      projectId,
      missionId,
      userWallet: wallet,
      signature,
      message,
      payload,
    });
    
    await saveProof(proof);
    
    return NextResponse.json({ ok: true, proof });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
