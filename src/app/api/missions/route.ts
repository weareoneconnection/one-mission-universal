// apps/web/src/app/api/missions/route.ts
import { NextResponse } from "next/server";
import { CreateMissionSchema } from "@/lib/missions/validators";
import { createMission, listMissions, setMissionActive } from "@/lib/missions/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") || undefined;
    const active = url.searchParams.get("active");
    const activeOnly = active === "1" || active === "true";

    const missions = await listMissions({ projectId, activeOnly });
    return NextResponse.json({ ok: true, missions }, { status: 200 });
  } catch (e: any) {
    console.error("[GET /api/missions] error:", e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = CreateMissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const m = await createMission(parsed.data);
    return NextResponse.json({ ok: true, mission: m }, { status: 201 });
  } catch (e: any) {
    console.error("[POST /api/missions] error:", e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id || "");
    const active = Boolean(body?.active);

    if (!id) {
      return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
    }

    const updated = await setMissionActive(id, active);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, mission: updated }, { status: 200 });
  } catch (e: any) {
    console.error("[PATCH /api/missions] error:", e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
