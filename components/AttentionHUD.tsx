"use client";

import { useState } from "react";
import type { DistractionReason } from "@/lib/hooks/useAttention";

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
          ⚠️ {error}
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
                <span className="text-2xl">📷</span>
              </div>
            )}
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="absolute bottom-1 right-1 font-pixel text-pixel-xs bg-black/50 text-white rounded px-1.5 py-0.5"
            >
              {showPreview ? "Hide" : "Show"}
            </button>
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
