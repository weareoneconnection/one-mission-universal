import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { listProofsByProjectAndStatus } from "@/lib/proof-store";
import type { Proof } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeTrim(v: any) {
  return String(v ?? "").trim();
}

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * GET /api/projects/:projectId/approvals
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { projectId } = await ctx.params;
    const id = safeTrim(projectId);

    if (!id) {
      return NextResponse.json({ ok: false, error: "MISSING_PROJECT_ID" }, { status: 400 });
    }

    // 你原来的业务：列出待审批 proofs
    const proofs = (await listProofsByProjectAndStatus(id, "PENDING")) as Proof[];

    return NextResponse.json({ ok: true, proofs });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
