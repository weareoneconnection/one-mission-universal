import { NextResponse } from "next/server";
import { queueLength, getLastError, getLastSyncAt, getFinalizedCount } from "@/lib/server/chainQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const [len, lastError, lastSyncAt, finalized] = await Promise.all([
    queueLength(),
    getLastError(),
    getLastSyncAt(),
    getFinalizedCount(),
  ]);

  return NextResponse.json({
    ok: true,
    queue: { length: len },
    lastSyncAt,
    finalizedCount: finalized,
    lastError,
  });
}
