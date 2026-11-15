import type { ChallengeItem, ChallengeStatus } from "./challengeItems";

export const CHALLENGE_STATUS_LABELS: Record<ChallengeStatus, string> = {
  implemented: "Implemented",
  partial: "Partial",
  notIncluded: "Not included",
};

export function countByStatus(items: readonly ChallengeItem[]): Record<ChallengeStatus, number> {
  const counts: Record<ChallengeStatus, number> = { implemented: 0, partial: 0, notIncluded: 0 };
  for (const item of items) {
    counts[item.status] += 1;
  }
  return counts;
}

export function describeChallengeSummary(items: readonly ChallengeItem[]): string {
  const counts = countByStatus(items);
  return (
    `${items.length} items: ${counts.implemented} implemented, ${counts.partial} partial, ` +
    `${counts.notIncluded} not included.`
  );
}
