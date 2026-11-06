"use client";

interface SessionTimerProps {
  elapsedSeconds: number;
  focusedSeconds: number;
  distractedSeconds: number;
  /** Coins earned so far — calculateReward(focusedSeconds).coins, the same
   * formula endSession() pays out, so this never disagrees with the summary. */
  coinsSoFar: number;
}

export function formatClock(seconds: number): string {
  // Build Mandate Phase 3: focusedSeconds/distractedSeconds can now be
  // fractional (accrued from ∫ focusScore dt — see SessionContext.tsx),
  // floored here purely for mm:ss display; the precise value is still
  // what's stored/used for the coin calculation.
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60)
    .toString()
    .padStart(2, "0");
  const s = (whole % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function SessionTimer({
  elapsedSeconds,
  focusedSeconds,
  distractedSeconds,
  coinsSoFar,
}: SessionTimerProps) {
  const focusPct =
    elapsedSeconds > 0 ? Math.min(100, (focusedSeconds / elapsedSeconds) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div className="font-pixel text-pixel-2xl text-white tabular-nums" aria-label="Session time">
        {formatClock(elapsedSeconds)}
      </div>

      {/* Track gets a --grass-a outline: the old bare #2d4a2d track was
          1.47:1 against the page, under WCAG 1.4.11's 3:1 for the
          boundary of a meter. */}
      <div className="w-full flex flex-col gap-2">
        <div
          className="w-full h-3"
          role="meter"
          aria-label="Share of session spent focused"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(focusPct)}
          style={{ background: "#0a150a", outline: "2px solid #6aaa35" }}
        >
          <div
            className="h-full bg-farm-focused transition-[width] duration-1000 motion-reduce:transition-none"
            style={{ width: `${focusPct}%` }}
          />
        </div>
        <p className="font-pixel text-pixel-xs text-gray-400 text-right tabular-nums">
          {Math.round(focusPct)}% focused
        </p>
      </div>

      <dl className="grid grid-cols-3 w-full">
        <div className="flex flex-col items-center gap-2">
          <dt className="font-pixel text-pixel-xs text-gray-400 order-2">Focused</dt>
          <dd className="font-pixel text-pixel-lg text-farm-focused tabular-nums">{formatClock(focusedSeconds)}</dd>
        </div>
        <div className="flex flex-col items-center gap-2" style={{ borderInline: "2px solid #2d4a2d" }}>
          <dt className="font-pixel text-pixel-xs text-gray-400 order-2">Distracted</dt>
          <dd className="font-pixel text-pixel-lg text-farm-distracted tabular-nums">{formatClock(distractedSeconds)}</dd>
        </div>
        <div className="flex flex-col items-center gap-2">
          <dt className="font-pixel text-pixel-xs text-gray-400 order-2">Earned so far</dt>
          {/* Not <CoinDisplay>: its coin-pop animation fires on every
              value change, which here would be every focused second —
              constant peripheral motion on the one page meant for focus. */}
          <dd className="flex items-center gap-2 font-pixel text-pixel-lg tabular-nums" style={{ color: "#ffe566" }}>
            <span aria-hidden className="pixel-coin-icon" style={{ width: 16, height: 16 }} />
            {coinsSoFar.toLocaleString()}
          </dd>
        </div>
      </dl>
    </div>
  );
}
