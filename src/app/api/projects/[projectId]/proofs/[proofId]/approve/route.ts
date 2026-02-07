import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as ProofStore from "@/lib/proof-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeTrim(v: any) {
  return String(v ?? "").trim();
}

function pickStatus(v: string) {
  const s = safeTrim(v).toUpperCase();
  if (s === "PENDING" || s === "APPROVED" || s === "REJECTED" || s === "REVOKED") return s;
  return "";
}

/**
 * ✅ 无权限读取版：
 * - 不校验 session / x-wallet / admin
 * - 仅按 projectId + status(可选) 读取 proofs
 * - 依赖 proof-store 内部的读取逻辑（支持 memory/kv/redis 等）
 */
type Ctx = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { projectId } = await ctx.params;
    const pid = safeTrim(projectId);

    if (!pid) {
      return NextResponse.json({ ok: false, error: "MISSING_PROJECT_ID" }, { status: 400 });
    }

    const url = new URL(req.url);
    const status = pickStatus(url.searchParams.get("status") || "");

    // 兼容你项目里 proof-store 可能存在的不同函数名
    const store: any = ProofStore as any;

    const fn =
      store.getProjectProofs ||
      store.getProofsByProjectId ||
      store.listProjectProofs ||
      store.listProofsByProjectId ||
      store.getProofsForProject ||
      store.listProofsForProject;

    if (typeof fn !== "function") {
      return NextResponse.json(
        {
          ok: false,
          error: "PROOF_STORE_MISSING_LIST_FN",
          message:
            "Cannot find a list function in '@/lib/proof-store'. Expected one of: getProjectProofs/getProofsByProjectId/listProjectProofs/listProofsByProjectId/getProofsForProject/listProofsForProject",
        },
        { status: 500 }
      );
    }

    // 常见签名兼容：
    // - fn(projectId)
    // - fn(projectId, status)
    // - fn({ projectId, status })
    let proofs: any[] = [];

    try {
      // 尝试对象参数
      const r1 = await fn({ projectId: pid, status: status || undefined });
      if (Array.isArray(r1)) proofs = r1;
      else if (Array.isArray(r1?.proofs)) proofs = r1.proofs;
    } catch {
      // 回退到位置参数
      const r2 = status ? await fn(pid, status) : await fn(pid);
      if (Array.isArray(r2)) proofs = r2;
      else if (Array.isArray(r2?.proofs)) proofs = r2.proofs;
    }

    // 如果 store 没做 status 过滤，这里兜底过滤一次
    if (status) {
      proofs = (proofs || []).filter(
        (p: any) => String(p?.currentStatus || "").toUpperCase() === status
      );
    }

    return NextResponse.json({ ok: true, proofs });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
