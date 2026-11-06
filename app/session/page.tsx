"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/context/SessionContext";
import { useFarm } from "@/context/FarmContext";
import { useWebcam } from "@/lib/hooks/useWebcam";
import { useAttention } from "@/lib/hooks/useAttention";
import { useNeutralCalibration } from "@/lib/hooks/useNeutralCalibration";
import { getAttentionCalibration, saveAttentionCalibration } from "@/lib/storage";
import AttentionHUD from "@/components/AttentionHUD";
import AttentionDebugOverlay from "@/components/AttentionDebugOverlay";
import CalibrationScreen from "@/components/CalibrationScreen";
import SessionTimer, { formatClock } from "@/components/SessionTimer";
import RewardTiers from "@/components/RewardTiers";
import CoinDisplay from "@/components/CoinDisplay";
import PixelButton from "@/components/PixelButton";
import { calculateReward } from "@/lib/coins";

function SessionPageInner() {
  const { ledger } = useFarm();
  const router = useRouter();
  const {
    status,
    elapsedSeconds,
    focusedSeconds,
    distractedSeconds,
    lastSummary,
    startSession,
    endSession,
    abandonSession,
    setAttentionState,
    dismissSummary,
  } = useSession();

  const webcam = useWebcam();
  const attention = useAttention(
    webcam.videoRef,
    webcam.status === "active" && status === "running"
  );

  // Build Mandate Phase 2: neutral-pose calibration, run once (persisted)
  // before a session's first-ever start, re-runnable via "Recalibrate".
  // Only ever active pre-session (never concurrently with useAttention
  // above, which requires status === "running") — see
  // useNeutralCalibration's doc comment for why this is a separate
  // detector instance rather than a mode on useAttention.
  const [calibrationStep, setCalibrationStep] = useState<"idle" | "calibrating">("idle");
  const calibration = useNeutralCalibration(
    webcam.videoRef,
    webcam.status === "active" && calibrationStep === "calibrating"
  );

  useEffect(() => {
    if (calibrationStep === "calibrating" && calibration.status === "ok" && calibration.calibration) {
      saveAttentionCalibration(calibration.calibration);
      setCalibrationStep("idle");
      startSession(25);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startSession is stable (useCallback in SessionContext); including it would be a no-op dep, omitted to keep this effect keyed only on the calibration result
  }, [calibrationStep, calibration.status, calibration.calibration]);

  // Auto-reconnect camera when returning to this page mid-session.
  // When the user navigates away and back, the webcam stream has been
  // released (component unmounted) but the session is still running.
  // Re-requesting on mount restores the feed without any user action.
  useEffect(() => {
    if (status === "running" && webcam.status === "idle") {
      webcam.requestCamera();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount only

  // Build Mandate Phase 3: attention.focusScore changes essentially every
  // classifier frame (it's continuous), so including it as a dependency is
  // what pushes a fresh score into SessionContext's reward-accrual ref on
  // every frame, not just on binary focused/distracted transitions.
  useEffect(() => {
    if (status === "running") {
      setAttentionState(attention.isFocused, attention.faceDetected, attention.focusScore);
    }
  }, [attention.isFocused, attention.faceDetected, attention.focusScore, status, setAttentionState]);

  async function handleStart() {
    const granted = await webcam.requestCamera();
    if (!granted) return;
    if (getAttentionCalibration()) {
      startSession(25);
    } else {
      setCalibrationStep("calibrating");
    }
  }

  async function handleRecalibrate() {
    const granted = await webcam.requestCamera();
    if (granted) setCalibrationStep("calibrating");
  }

  const isRunning = status === "running";
  const isCalibrating = calibrationStep === "calibrating";
  const isIdle = (status === "idle" || status === "abandoned") && !isCalibrating;
  const liveReward = calculateReward(focusedSeconds);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#1a2e1a" }}>

      {/* Header — grid with two equal-width flanking columns, not flex+
          justify-between, so the title is truly centered on the full header
          width regardless of the left/right content's own widths (which
          differ: two buttons vs. one coin badge). Same pattern app/farm's
          header already uses. */}
      <header
        className="grid items-center gap-2 px-3 sm:px-5 py-3"
        style={{ gridTemplateColumns: "1fr auto 1fr", background: "#0a150a", borderBottom: "3px solid #2d4a2d" }}
      >
        <div className="flex items-center gap-2 justify-self-start">
          <Link href="/">
            <PixelButton variant="outline" size="sm">Home</PixelButton>
          </Link>
          <Link href="/farm">
            <PixelButton variant="outline" size="sm">Farm</PixelButton>
          </Link>
        </div>
        {/* Two spans, not `sm:text-pixel-lg`: the .text-pixel-* scale is
            plain CSS outside any @layer, so Tailwind can't generate
            responsive variants of it. At 16px the title wrapped to 2 lines
            between the header buttons on phones. */}
        <span className="justify-self-center whitespace-nowrap font-pixel text-white">
          <span className="sm:hidden text-pixel-md">Focus Session</span>
          <span className="hidden sm:inline text-pixel-lg">Focus Session</span>
        </span>
        <div className="justify-self-end">
          <CoinDisplay balance={ledger.balance} size="sm" />
        </div>
      </header>

      {/* Session summary modal */}
      {lastSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div
            className="pixel-panel flex flex-col items-center gap-5 w-full max-w-sm p-8"
          >
            <h2 className="font-pixel text-pixel-lg text-green-400">Session complete</h2>

            <div className="flex flex-col gap-3 w-full">
              {[
                // formatClock floors: since Phase 3 these are fractional
                // (∫ focusScore dt), and the old `${s % 60}s` printed
                // things like "12.734s".
                { label: "Focused",    value: formatClock(lastSummary.focusedSeconds),    color: "#4ade80" },
                { label: "Distracted", value: formatClock(lastSummary.distractedSeconds), color: "#f87171" },
                { label: "Multiplier", value: `${lastSummary.tierMultiplier}×`, color: "#fbbf24" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between font-pixel text-pixel-sm">
                  <span className="text-gray-400">{label}</span>
                  <span style={{ color }}>{value}</span>
                </div>
              ))}
              <div
                className="flex justify-between font-pixel text-pixel-md pt-3"
                style={{ borderTop: "2px solid #2d4a2d" }}
              >
                <span className="text-gray-300">Coins earned</span>
                <CoinDisplay balance={lastSummary.coinsEarned} size="sm" />
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <PixelButton className="flex-1" onClick={() => { dismissSummary(); router.push("/farm"); }}>
                Go to farm
              </PixelButton>
              <Link href="/shop" className="flex-1" onClick={dismissSummary}>
                <PixelButton variant="outline" className="w-full">Visit shop</PixelButton>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* One 480px column: wide enough for a camera preview you can
          actually see yourself in (was a fixed 200×150), narrow enough
          that the timer/stats stay a single glance away from it. */}
      <main className="flex-1 w-full max-w-[480px] mx-auto flex flex-col items-center justify-center px-4 py-8 gap-8">

        <AttentionHUD
          isFocused={attention.isFocused}
          faceDetected={attention.faceDetected}
          isDetecting={attention.isDetecting}
          error={attention.error}
          videoRef={webcam.videoRef}
          webcamStatus={webcam.status}
          distractedReason={attention.distractedReason}
          sessionRunning={isRunning}
        />

        {isRunning && (
          <SessionTimer
            elapsedSeconds={elapsedSeconds}
            focusedSeconds={focusedSeconds}
            distractedSeconds={distractedSeconds}
            coinsSoFar={liveReward.coins}
          />
        )}

        {webcam.error && (
          <div
            className="pixel-panel font-pixel text-pixel-sm text-center px-4 py-3 w-full"
            style={{ color: "#fbbf24" }}
          >
            {webcam.error}
          </div>
        )}

        {/* Controls */}
        {isCalibrating ? (
          <CalibrationScreen
            status={calibration.status}
            progress={calibration.progress}
            retryReason={calibration.retryReason}
            error={calibration.error}
            onRetry={calibration.retry}
          />
        ) : isIdle ? (
          // Stacked full-width, not side by side: at Press Start 2P's width,
          // "Start without camera" wraps to 3 lines in half of 480px.
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex flex-col gap-4 w-full">
              <PixelButton size="lg" onClick={handleStart}>
                Start with camera
              </PixelButton>
              <PixelButton variant="outline" size="lg" onClick={() => startSession(25)}>
                Start without camera
              </PixelButton>
            </div>
            {/* SessionContext never feeds a focus score without a camera,
                so these sessions always pay 0 — say so before, not after. */}
            <p className="font-pixel text-pixel-xs text-gray-400 text-center">
              Without a camera the timer runs, but you won&apos;t earn coins.
            </p>
            {webcam.status === "active" && (
              <PixelButton variant="tertiary" onClick={handleRecalibrate}>
                Recalibrate camera
              </PixelButton>
            )}
          </div>
        ) : isRunning ? (
          <div className="flex items-center gap-4">
            <PixelButton size="md" onClick={endSession}>Finish session</PixelButton>
            <PixelButton variant="danger" size="sm" onClick={abandonSession}>Abandon</PixelButton>
          </div>
        ) : null}

        {/* Same card before and during a session; mid-session it marks the
            tier you're currently in (only camera sessions can earn, so
            no highlight when there's no camera). */}
        {(isIdle || isRunning) && (
          <RewardTiers
            activeMultiplier={isRunning && webcam.status === "active" ? liveReward.tierMultiplier : undefined}
          />
        )}
      </main>

      {/* Suspense: AttentionDebugOverlay reads useSearchParams(), which
          Next.js requires a Suspense boundary around. */}
      <Suspense fallback={null}>
        <AttentionDebugOverlay attention={attention} />
      </Suspense>
    </div>
  );
}

// SessionProvider now lives in the root layout so the timer
// survives navigation — no wrapper needed here.
export default function SessionPage() {
  return <SessionPageInner />;
}
