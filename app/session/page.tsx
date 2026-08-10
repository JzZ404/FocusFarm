"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/context/SessionContext";
import { useFarm } from "@/context/FarmContext";
import { useWebcam } from "@/lib/hooks/useWebcam";
import { useAttention } from "@/lib/hooks/useAttention";
import AttentionHUD from "@/components/AttentionHUD";
import SessionTimer from "@/components/SessionTimer";
import CoinDisplay from "@/components/CoinDisplay";
import PixelButton from "@/components/PixelButton";

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

  useEffect(() => {
    if (status === "running") {
      setAttentionState(attention.isFocused, attention.faceDetected);
    }
  }, [attention.isFocused, attention.faceDetected, status, setAttentionState]);

  async function handleStart() {
    const granted = await webcam.requestCamera();
    if (granted) startSession(25);
  }

  const isRunning = status === "running";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#1a2e1a" }}>

      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3"
        style={{ background: "#0a150a", borderBottom: "3px solid #2d4a2d" }}
      >
        <div className="flex items-center gap-2">
          <Link href="/">
            <PixelButton variant="outline" size="sm">Home</PixelButton>
          </Link>
          <Link href="/farm">
            <PixelButton variant="outline" size="sm">Farm</PixelButton>
          </Link>
        </div>
        <span className="font-pixel text-pixel-lg text-white">Focus Session</span>
        <CoinDisplay balance={ledger.balance} size="sm" />
      </header>

      {/* Session summary modal */}
      {lastSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div
            className="pixel-panel flex flex-col items-center gap-5 w-full max-w-sm p-8"
          >
            <div className="text-4xl">🎉</div>
            <h2 className="font-pixel text-pixel-lg text-green-400">Session Complete!</h2>

            <div className="flex flex-col gap-3 w-full">
              {[
                { label: "Focused", value: `${Math.floor(lastSummary.focusedSeconds/60)}m ${lastSummary.focusedSeconds%60}s`, color: "#4ade80" },
                { label: "Away",    value: `${Math.floor(lastSummary.distractedSeconds/60)}m ${lastSummary.distractedSeconds%60}s`, color: "#f87171" },
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
                Farm
              </PixelButton>
              <Link href="/shop" className="flex-1" onClick={dismissSummary}>
                <PixelButton variant="outline" className="w-full">Shop</PixelButton>
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-7">

        {/* Attention HUD */}
        <AttentionHUD
          isFocused={attention.isFocused}
          faceDetected={attention.faceDetected}
          isDetecting={attention.isDetecting}
          error={attention.error}
          videoRef={webcam.videoRef}
          webcamStatus={webcam.status}
          distractedReason={attention.distractedReason}
        />

        {/* Live timer */}
        {isRunning && (
          <SessionTimer
            elapsedSeconds={elapsedSeconds}
            focusedSeconds={focusedSeconds}
            distractedSeconds={distractedSeconds}
          />
        )}

        {/* Camera error */}
        {webcam.error && (
          <div
            className="pixel-panel font-pixel text-pixel-sm text-center px-4 py-3 max-w-xs"
            style={{ color: "#fbbf24" }}
          >
            {webcam.error}
          </div>
        )}

        {/* Controls */}
        {status === "idle" || status === "abandoned" ? (
          <div className="flex flex-col items-center gap-3">
            <PixelButton size="lg" onClick={handleStart}>
              Start with Camera
            </PixelButton>
            <PixelButton variant="outline" size="sm" onClick={() => startSession(25)}>
              Start without Camera
            </PixelButton>
          </div>
        ) : isRunning ? (
          <div className="flex gap-3">
            <PixelButton size="md" onClick={endSession}>Finish</PixelButton>
            <PixelButton variant="danger" size="sm" onClick={abandonSession}>Abandon</PixelButton>
          </div>
        ) : null}

        {/* Reward tier reference card */}
        {(status === "idle" || status === "abandoned") && (
          <div className="pixel-panel p-4 w-full max-w-xs">
            <p className="font-pixel text-pixel-xs text-center text-gray-400 mb-3">
              Coin Rewards
            </p>
            <div className="flex flex-col gap-2">
              {[
                /* DEMO MODE: minutes → seconds. Revert ranges after demo. */
                { label: "Warm Up   (0–9s)",   mult: "0.5×", color: "#fbbf24" },
                { label: "Good Start (10–19s)", mult: "1×",   color: "#4ade80" },
                { label: "Solid Focus (20–29s)",mult: "1.5×", color: "#60a5fa" },
                { label: "Deep Focus  (30s+)", mult: "2×",   color: "#c084fc" },
              ].map(({ label, mult, color }) => (
                <div key={label} className="flex justify-between font-pixel text-pixel-xs">
                  <span className="text-gray-500">{label}</span>
                  <span style={{ color }}>{mult}</span>
                </div>
              ))}
            </div>
            <p className="font-pixel text-pixel-xs text-center text-gray-500 mt-3">
              5 coins / focused sec × multiplier
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// SessionProvider now lives in the root layout so the timer
// survives navigation — no wrapper needed here.
export default function SessionPage() {
  return <SessionPageInner />;
}
