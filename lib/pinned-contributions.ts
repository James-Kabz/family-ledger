export type PinnedContributionSeed = {
  name: string;
  amount: number;
};

export const PINNED_CONTRIBUTION_ROWS: readonly PinnedContributionSeed[] = [
  { name: "Kabogo's Family", amount: 300000 },
  { name: "Hillary Kabogo Milestone Fraternity", amount: 100000 },
  { name: "Robert Kabogo Milestone Fraternity", amount: 100000 },
  { name: "Paul Kabogo Milestone Fraternity", amount: 100000 },
  { name: "Daniel Kabogo Milestone Fraternity", amount: 100000 },
] as const;
