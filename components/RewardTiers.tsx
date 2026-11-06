"use client";

// DEMO MODE: ranges are in focused *seconds* to match lib/coins.ts's
// demo-scaled calculateReward(). Revert ranges alongside it after the demo.
// Rows are keyed by multiplier so a live session can highlight its current
// tier straight from calculateReward()'s tierMultiplier — the same value
// that's paid out at the end — instead of re-deriving thresholds here.
const TIERS = [
  { name: "Warm up", range: "0–9s", multiplier: 0.5, color: "#fbbf24" },
  { name: "Good start", range: "10–19s", multiplier: 1, color: "#4ade80" },
  { name: "Solid focus", range: "20–29s", multiplier: 1.5, color: "#60a5fa" },
  { name: "Deep focus", range: "30s+", multiplier: 2, color: "#c084fc" },
];

interface RewardTiersProps {
  /** Current session's tier multiplier; omit on the idle page. */
  activeMultiplier?: number;
}

export default function RewardTiers({ activeMultiplier }: RewardTiersProps) {
  return (
    <section className="pixel-panel w-full px-5 py-5 flex flex-col gap-4" aria-labelledby="reward-tiers-heading">
      <h2 id="reward-tiers-heading" className="font-pixel text-pixel-md text-white">
        Coin rewards
      </h2>
      <ul className="flex flex-col gap-1">
        {TIERS.map((t) => {
          const active = t.multiplier === activeMultiplier;
          return (
            <li
              key={t.name}
              aria-current={active ? "true" : undefined}
              className="grid items-center gap-3 px-2 py-2"
              style={{
                gridTemplateColumns: "10px 1fr auto auto",
                background: active ? "rgba(255,255,255,0.07)" : "transparent",
                boxShadow: active ? `inset 3px 0 0 ${t.color}` : "none",
              }}
            >
              <span aria-hidden className="w-[10px] h-[10px]" style={{ background: t.color }} />
              <span className="font-pixel text-pixel-sm" style={{ color: active ? t.color : "#ffffff" }}>
                {t.name}
                {active && <span className="text-pixel-xs text-gray-400 ml-2">now</span>}
              </span>
              <span className="font-pixel text-pixel-xs text-gray-400 tabular-nums">{t.range}</span>
              <span className="font-pixel text-pixel-sm tabular-nums text-right w-[5ch]" style={{ color: t.color }}>
                {t.multiplier}×
              </span>
            </li>
          );
        })}
      </ul>
      <p className="font-pixel text-pixel-xs text-gray-400">
        5 coins per focused second, times your tier.
      </p>
    </section>
  );
}
