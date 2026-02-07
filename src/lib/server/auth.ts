export function getHeaderWallet(req: Request) {
  const w =
    req.headers.get("x-wallet") ||
    req.headers.get("X-Wallet") ||
    req.headers.get("x_wallet") ||
    req.headers.get("X_WALLET") ||
    "";
  return String(w).trim();
}
