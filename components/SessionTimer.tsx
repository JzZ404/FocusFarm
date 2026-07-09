"use client";

interface SessionTimerProps {
  elapsedSeconds: number;
  focusedSeconds: number;
  distractedSeconds: number;
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function SessionTimer({
  elapsedSeconds,
  focusedSeconds,
  distractedSeconds,
}: SessionTimerProps) {
  const focusPct =
    elapsedSeconds > 0 ? (focusedSeconds / elapsedSeconds) * 100 : 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="font-pixel text-pixel-2xl text-white tabular-nums">
        {fmt(elapsedSeconds)}
      </div>

      <div className="w-full max-w-sm bg-farm-border rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-farm-focused transition-all duration-1000"
          style={{ width: `${focusPct}%` }}
        />
      </div>

      <div className="flex gap-6 font-pixel text-pixel-sm">
        <div className="flex flex-col items-center gap-1">
          <span className="text-farm-focused">{fmt(focusedSeconds)}</span>
          <span className="text-gray-400">Focused</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-farm-distracted">{fmt(distractedSeconds)}</span>
          <span className="text-gray-400">Away</span>
        </div>
      </div>
    </div>
  );
}
