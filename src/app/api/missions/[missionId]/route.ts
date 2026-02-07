import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { listMissions } from "@/lib/missions/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ missionId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { missionId } = await ctx.params;
    const id = String(missionId || "").trim();

    if (!id) {
      return NextResponse.json({ ok: false, error: "missing missionId" }, { status: 400 });
    }

    const missions = await listMissions(); // 逻辑完全不变
    const mission = missions.find((m) => m.id === id) || null;

    if (!mission) {
      return NextResponse.json({ ok: false, error: "MISSION_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, mission });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
