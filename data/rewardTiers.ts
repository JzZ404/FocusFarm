export interface RewardTier {
  minMinutes: number;
  multiplier: number;
  label: string;
  color: string;
}

export const REWARD_TIERS: RewardTier[] = [
  { minMinutes: 30, multiplier: 2.0, label: "Deep Focus", color: "#a855f7" },
  { minMinutes: 20, multiplier: 1.5, label: "Solid Focus", color: "#3b82f6" },
  { minMinutes: 10, multiplier: 1.0, label: "Good Start", color: "#4ade80" },
  { minMinutes: 0, multiplier: 0.5, label: "Warm Up", color: "#fbbf24" },
];

export function getTierForMinutes(minutes: number): RewardTier {
  return (
    REWARD_TIERS.find((tier) => minutes >= tier.minMinutes) ??
    REWARD_TIERS[REWARD_TIERS.length - 1]
  );
}
