import { ProofEvent } from "./proof-events";

export function deriveProofState(events: ProofEvent[]) {
  let state = {
    currentStatus: "PENDING" as
      | "PENDING"
      | "APPROVED"
      | "REJECTED"
      | "REVOKED",
    approvedAt: undefined as number | undefined,
    approvedBy: undefined as string | undefined,
  };

  for (const e of events) {
    switch (e.type) {
      case "SUBMITTED":
        state.currentStatus = "PENDING";
        break;

      case "APPROVED":
        state.currentStatus = "APPROVED";
        state.approvedAt = e.at;
        state.approvedBy = e.by;
        break;

      case "REJECTED":
        state.currentStatus = "REJECTED";
        break;

      case "REVOKED":
        state.currentStatus = "REVOKED";
        break;
    }
  }

  return state;
}
