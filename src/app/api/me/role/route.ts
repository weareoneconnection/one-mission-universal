// src/lib/server/role.ts
export type WalletRole = "USER" | "OWNER" | "ADMIN";

/**
 * ✅ 动态角色识别（不会挡住新项目方）
 * - 默认 USER
 * - 如果该 wallet 是任意项目的 ownerWallet => OWNER
 * - 如果在 ADMIN allowlist => ADMIN（可选）
 */
export async function resolveWalletRole(wallet: string): Promise<WalletRole> {
  const w = String(wallet || "").trim();
  if (!w) return "USER";

  // 0) optional admin allowlist
  // 例如：process.env.ADMIN_WALLETS="aaa,bbb,ccc"
  const admins = String(process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  if (admins.includes(w)) return "ADMIN";

  // 1) owner check: 只要存在任何项目 ownerWallet === wallet => OWNER
  const isOwner = await walletOwnsAnyProject(w);
  return isOwner ? "OWNER" : "USER";
}

/**
 * landing 只是建议，不要用于“强制把用户踢走”
 */
export function defaultLanding(role: WalletRole) {
  if (role === "ADMIN") return "/dashboard";
  if (role === "OWNER") return "/projects";
  return "/missions";
}

/* -------------------------
   internal helpers
------------------------- */

async function walletOwnsAnyProject(wallet: string): Promise<boolean> {
  // 这里用“动态 import”去兼容你项目里不同的 projects store 路径。
  // 你只需要保证：某个模块导出 listProjects() 或 getProjects() 或 loadProjects()
  // 并返回 { ownerWallet: string }[] 或类似结构即可。

  const candidates = [
    "@/lib/projects/store",
    "@/lib/projects/project-store",
    "@/lib/project-store",
    "@/lib/project-store/index",
  ];

  for (const path of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const mod: any = await import(path);

      const fn =
        mod?.listProjects ||
        mod?.getProjects ||
        mod?.loadProjects ||
        mod?.allProjects ||
        null;

      if (typeof fn !== "function") continue;

      // eslint-disable-next-line no-await-in-loop
      const res = await fn();
      const projects = normalizeProjects(res);

      if (projects.some((p) => String(p.ownerWallet || "").trim() === wallet)) return true;
    } catch {
      // try next candidate
    }
  }

  // 如果你确实没有任何 store 导出函数（只在 API route 里写了逻辑），
  // 那就把 projects store 抽到 lib 里并导出 listProjects()，role 才能读到。
  return false;
}

function normalizeProjects(res: any): Array<{ ownerWallet?: string }> {
  // 兼容多种返回结构
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.projects)) return res.projects;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}
