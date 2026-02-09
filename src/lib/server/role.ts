// src/lib/server/role.ts
export type WalletRole = "USER" | "OWNER" | "ADMIN";

/**
 * ✅ 动态角色识别（不会挡住新项目方）
 * - 默认 USER
 * - 如果该 wallet 是任意项目的 ownerWallet => OWNER
 * - 如果在 ADMIN allowlist => ADMIN（可选）
 *
 * 注意：landing 只是建议，不要用于“强制把用户踢走”
 */

// ---- small in-memory cache (server) ----
type CacheEntry = { at: number; val: boolean };
const OWNER_CACHE = new Map<string, CacheEntry>();
const OWNER_CACHE_TTL_MS = 15_000; // 15s 足够了（role API 会被频繁调用）

function now() {
  return Date.now();
}

function parseAdminWallets(): string[] {
  return String(process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function resolveWalletRole(wallet: string): Promise<WalletRole> {
  const w = String(wallet || "").trim();
  if (!w) return "USER";

  // 0) optional admin allowlist
  const admins = parseAdminWallets();
  if (admins.includes(w)) return "ADMIN";

  // 1) owner check
  const isOwner = await walletOwnsAnyProject(w);
  return isOwner ? "OWNER" : "USER";
}

export function defaultLanding(role: WalletRole) {
  if (role === "ADMIN") return "/dashboard";
  if (role === "OWNER") return "/projects";
  return "/missions";
}

/* -------------------------
   internal helpers
------------------------- */

/**
 * ✅ 稳定版本：直接从 projects store 读取
 * 你项目大概率就是这个路径：src/lib/projects/store.ts
 * 如果你真实路径不同，只需要改下面这一行 import 路径即可。
 */
async function walletOwnsAnyProject(wallet: string): Promise<boolean> {
  // cache
  const hit = OWNER_CACHE.get(wallet);
  if (hit && now() - hit.at < OWNER_CACHE_TTL_MS) return hit.val;

  let ok = false;

  try {
    // ✅ 推荐：固定 import（稳定、可 build、可 tree-shake）
    const mod: any = await import("../projects/store"); // <-- 如不匹配，改这里即可
    const fn =
      mod?.listProjects ||
      mod?.getProjects ||
      mod?.loadProjects ||
      mod?.allProjects ||
      null;

    if (typeof fn === "function") {
      const res = await fn();
      const projects = normalizeProjects(res);
      ok = projects.some((p) => String(p.ownerWallet || "").trim() === wallet);
    } else {
      ok = false;
    }
  } catch {
    // 如果你 projects store 路径不同，这里会进 catch
    ok = false;
  }

  OWNER_CACHE.set(wallet, { at: now(), val: ok });
  return ok;
}

function normalizeProjects(res: any): Array<{ ownerWallet?: string }> {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.projects)) return res.projects;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

