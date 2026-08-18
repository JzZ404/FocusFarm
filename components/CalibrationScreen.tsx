"use client";

import PixelButton from "./PixelButton";
import type { NeutralCalibrationStatus } from "@/lib/hooks/useNeutralCalibration";

/**
 * Build Mandate Phase 2's onboarding step: "look at the center of your
 * screen and hold still" for a few seconds, so lib/attention/classify.ts
 * can correct for this person's own resting head/gaze pose instead of
 * assuming everyone's neutral position is dead-center. Renders in place of
 * the session's Start/Finish controls (see app/session/page.tsx) — the
 * live camera preview above it (AttentionHUD, already always mounted) is
 * what the user actually watches themselves in, so this component owns no
 * video element of its own.
 */
interface CalibrationScreenProps {
  status: NeutralCalibrationStatus;
  /** 0..1, meaningful while status === "sampling". */
  progress: number;
  retryReason: string | null;
  error: string | null;
  onRetry: () => void;
}

export default function CalibrationScreen({
  status,
  progress,
  retryReason,
  error,
  onRetry,
}: CalibrationScreenProps) {
  if (status === "error") {
    return (
      <div className="pixel-panel p-4 w-full max-w-xs flex flex-col items-center gap-3">
        <p className="font-pixel text-pixel-sm text-yellow-400 text-center">
          {error ?? "Calibration failed."}
        </p>
        <PixelButton onClick={onRetry}>Try Again</PixelButton>
      </div>
    );
  }

  return (
    <div className="pixel-panel p-4 w-full max-w-xs flex flex-col items-center gap-3">
      <p className="font-pixel text-pixel-sm text-white text-center">
        Look at the center of your screen and hold still
      </p>
      <div
        className="w-full h-3 rounded-full overflow-hidden"
        style={{ background: "#0a150a" }}
      >
        <div
          className="h-full transition-all duration-100"
          style={{ width: `${Math.round(progress * 100)}%`, background: "#4ade80" }}
        />
      </div>
      {status === "retry" && retryReason && (
        <p className="font-pixel text-pixel-xs text-yellow-400 text-center">
          {retryReason} — retrying...
        </p>
      )}
      {status === "ok" && (
        <p className="font-pixel text-pixel-sm text-green-400 text-center">✓ Calibrated</p>
      )}
    </div>
  );
}
