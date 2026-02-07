import "server-only";
import { kvGet, kvSet } from "@/lib/server/kv";

export type Mission = {
  id: string;
  projectId: string;
  title: string;
  points: number;
  status?: "DRAFT" | "PUBLISHED";
  createdAt: number;
};

const IDX = "missions:index";
const MKEY = (id: string) => `mission:${id}`;

export async function listMissions(): Promise<Mission[]> {
  const ids = (await kvGet<string[]>(IDX)) ?? [];
  const out: Mission[] = [];
  for (const id of ids) {
    const m = await kvGet<Mission>(MKEY(id));
    if (m) out.push(m);
  }
  // newest first
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return out;
}

export async function getMission(id: string): Promise<Mission | null> {
  return await kvGet<Mission>(MKEY(id));
}

export async function upsertMission(m: Mission): Promise<void> {
  const ids = (await kvGet<string[]>(IDX)) ?? [];
  if (!ids.includes(m.id)) ids.push(m.id);
  await kvSet(IDX, ids);
  await kvSet(MKEY(m.id), m);
}
