"use client";

import { useState } from "react";
import type { DistractionReason } from "@/lib/hooks/useAttention";
import PixelButton from "./PixelButton";

interface AttentionHUDProps {
  isFocused: boolean;
  faceDetected: boolean;
  isDetecting: boolean;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  webcamStatus: string;
  distractedReason?: DistractionReason;
}

const REASON_LABEL: Record<Exclude<DistractionReason, null>, string> = {
  eyes_closed: "Eyes closed",
  looking_away: "Eyes off screen",
  head_extreme: "Head turned too far",
  no_face: "No face detected",
};

export default function AttentionHUD({
  isFocused,
  faceDetected,
  isDetecting,
  error,
  videoRef,
  webcamStatus,
  distractedReason,
}: AttentionHUDProps) {
  const [showPreview, setShowPreview] = useState(true);

  const statusText = !isDetecting
    ? "Initializing..."
    : !faceDetected
    ? "No face detected"
    : isFocused
    ? "FOCUSED"
    : "DISTRACTED";

  const statusColor = !isDetecting
    ? "text-gray-400"
    : !faceDetected
    ? "text-yellow-400"
    : isFocused
    ? "text-farm-focused"
    : "text-farm-distracted";

  const ringColor = isFocused && faceDetected ? "border-farm-focused" : "border-farm-distracted";

  return (
    <div className="flex flex-col items-center gap-3">
      {error && (
        <div className="font-pixel text-pixel-sm text-yellow-400 bg-yellow-900/30 border border-yellow-500/30 rounded px-3 py-2 text-center max-w-xs">
          {error}
        </div>
      )}

      <div
        className={`relative rounded-lg border-2 overflow-hidden transition-colors duration-500 ${ringColor}`}
        style={{ width: 200, height: 150 }}
      >
        {webcamStatus === "active" ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${showPreview ? "block" : "hidden"}`}
              style={{ transform: "scaleX(-1)" }}
            />
            {!showPreview && (
              <div className="w-full h-full bg-farm-panel flex items-center justify-center">
                <span className="font-pixel text-pixel-sm text-gray-500">Preview hidden</span>
              </div>
            )}
            {/* Was a bare 11px-tall button with no padding — under WCAG
                2.5.8's 24x24px target-size minimum — and its default focus
                ring would've been cropped by this container's
                overflow-hidden (see pixel-btn-tertiary-inset in globals.css).
                Backing bumped toward-opaque (was black/50) since the actual
                backdrop here is a live, unpredictable camera feed, not a
                fixed app color — needs to stay legible against any frame.
                variant temporarily "outline" instead of "tertiary": the
                tertiary variant/its CSS lives in the unmerged
                feature/starter-menu-and-design-system work, not on main —
                using it here broke the Vercel build (PixelButton.tsx on
                main only supports primary/outline/danger). Switch back to
                "tertiary" once that branch merges. */}
            <PixelButton
              variant="outline"
              onClick={() => setShowPreview((v) => !v)}
              className="pixel-btn-tertiary-inset absolute bottom-1 right-1"
              style={{ background: "rgba(0,0,0,0.85)" }}
            >
              {showPreview ? "Hide" : "Show"}
            </PixelButton>
          </>
        ) : (
          <div className="w-full h-full bg-farm-panel flex items-center justify-center">
            <span className="font-pixel text-pixel-sm text-gray-500 text-center px-2">
              {webcamStatus === "denied"
                ? "Camera denied"
                : "No camera"}
            </span>
          </div>
        )}
      </div>

      <div
        className={`font-pixel text-pixel-lg transition-colors duration-300 ${statusColor}`}
      >
        {statusText}
      </div>

      {isDetecting && !isFocused && distractedReason && (
        <div className="font-pixel text-pixel-sm text-gray-400">
          {REASON_LABEL[distractedReason]}
        </div>
      )}

      {!isDetecting && webcamStatus === "active" && (
        <div className="font-pixel text-pixel-sm text-gray-500">Loading AI model...</div>
      )}
    </div>
  );
}
