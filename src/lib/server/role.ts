// src/lib/server/role.ts
import { listProjects } from "@/lib/projects/store"; // ✅ 用你现有的项目读取逻辑（按你项目真实路径改这一行）

export type WalletRole = "OWNER" | "USER";

function normWallet(s: string) {
  return String(s || "").trim().toLowerCase();
}

/**
 * OWNER: wallet matches any project's ownerWallet
 * USER: otherwise
 */
export async function resolveWalletRole(wallet: string): Promise<WalletRole> {
  const w = normWallet(wallet);
  if (!w) return "USER";

  const projects = await listProjects(); // ✅ 必须和 /api/projects 同一套 store
  const isOwner = (projects || []).some((p: any) => normWallet(p.ownerWallet) === w);

  return isOwner ? "OWNER" : "USER";
}

/** 入口分流规则（你要的：OWNER 进项目页，USER 进任务页） */
export function defaultLanding(role: WalletRole) {
  return role === "OWNER" ? "/projects" : "/missions";
}

/** 访问控制规则 */
export function canAccess(pathname: string, role: WalletRole) {
  const p = pathname || "/";
  const isProjectArea = p.startsWith("/projects") || p.startsWith("/dashboard");
  const isUserArea = p.startsWith("/missions") || p.startsWith("/profile");

  // OWNER 只能项目区
  if (role === "OWNER" && isUserArea) return false;

  // USER 只能用户区
  if (role === "USER" && isProjectArea) return false;

  return true;
}
