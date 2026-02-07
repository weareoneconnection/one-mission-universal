export function computeProofResult(decision: "APPROVED" | "REJECTED") {
  if (decision === "APPROVED") {
    return {
      points: 10,          // 👈 你以后可以改成 mission 配置
      reputationDelta: 1,
    };
  }

  return {
    points: 0,
    reputationDelta: -1,
  };
}
