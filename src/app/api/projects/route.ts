// apps/web/src/app/api/projects/route.ts
import { NextResponse } from "next/server";
import { CreateProjectSchema } from "@/lib/projects/validators";
import { createProject, listProjects } from "@/lib/projects/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({ ok: true, projects }, { status: 200 });
  } catch (e: any) {
    console.error("[GET /api/projects] error:", e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = CreateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const p = await createProject(parsed.data);
    return NextResponse.json({ ok: true, project: p }, { status: 201 });
  } catch (e: any) {
    console.error("[POST /api/projects] error:", e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
