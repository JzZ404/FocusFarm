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
  /** True while a session is running (with or without a camera). Without
   * it, "detector not running yet" (pre-session) and "detector still
   * loading" (mid-session) look identical from isDetecting alone — the
   * old HUD read "Initializing..." on the idle page before the camera was
   * even requested. */
  sessionRunning: boolean;
}

const REASON_LABEL: Record<Exclude<DistractionReason, null>, string> = {
  eyes_closed: "Eyes closed",
  looking_away: "Eyes off screen",
  head_extreme: "Head turned too far",
  no_face: "No face detected",
};

// Same semantic colors as DESIGN.md (focused / distracted / coin-yellow for
// "needs attention" / --grass-a ready), plus gray for camera-off/loading —
// a green "Camera off" read as a good state. All ≥6:1 on #0f1f0f.
const STATE_COLOR = {
  ready: "#6aaa35",
  off: "#9ca3af",
  loading: "#9ca3af",
  noFace: "#fbbf24",
  focused: "#4ade80",
  distracted: "#f87171",
} as const;

type HudState = keyof typeof STATE_COLOR;

function describe(p: AttentionHUDProps): { state: HudState; label: string; detail: string | null } {
  const cameraOn = p.webcamStatus === "active";
  if (!p.sessionRunning) {
    return cameraOn
      ? { state: "ready", label: "Camera ready", detail: null }
      : { state: "off", label: "Camera off", detail: null };
  }
  if (!cameraOn) {
    return { state: "off", label: "Camera off", detail: "Timer only. Camera sessions earn coins." };
  }
  if (!p.isDetecting) return { state: "loading", label: "Starting face tracker", detail: null };
  if (!p.faceDetected) return { state: "noFace", label: "No face in view", detail: "Move back in front of the camera" };
  if (p.isFocused) return { state: "focused", label: "Focused", detail: null };
  return {
    state: "distracted",
    label: "Distracted",
    detail: p.distractedReason ? REASON_LABEL[p.distractedReason] : null,
  };
}

export default function AttentionHUD(props: AttentionHUDProps) {
  const { error, videoRef, webcamStatus } = props;
  const [showPreview, setShowPreview] = useState(true);
  const { state, label, detail } = describe(props);
  const color = STATE_COLOR[state];
  const cameraOn = webcamStatus === "active";

  return (
    <div className="flex flex-col gap-3 w-full">
      {error && (
        <div className="pixel-panel font-pixel text-pixel-sm text-center px-4 py-3" style={{ color: "#fbbf24" }}>
          {error}
        </div>
      )}

      <div
        className="cam-frame"
        style={{ "--cam-state": color } as React.CSSProperties}
      >
        <div className="relative w-full aspect-[4/3] overflow-hidden bg-farm-panel">
          {cameraOn ? (
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
                <div className="absolute inset-0 flex items-center justify-center px-6">
                  <span className="font-pixel text-pixel-sm text-gray-400 text-center">
                    Preview hidden. Detection is still on.
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <span className="font-pixel text-pixel-sm text-gray-400 text-center">
                {webcamStatus === "denied"
                  ? "Camera access is blocked. Allow it in your browser's site settings."
                  : "Your camera preview shows up here"}
              </span>
            </div>
          )}
        </div>

        {/* Status strip — attached to the frame rather than floating below
            it, so the label and the ring color read as one signal. The
            Hide/Show toggle moved here from its old overlay spot inside the
            video's overflow-hidden box, which is what needed the
            black/0.85 backing and the inset focus-ring workaround. */}
        <div className="flex items-center gap-3 px-2 pt-3 pb-1 min-h-[52px]">
          <span
            aria-hidden
            className="shrink-0 w-3 h-3 transition-colors duration-300 motion-reduce:transition-none"
            style={{ background: color }}
          />
          <div className="flex flex-col gap-1 min-w-0" role="status" aria-live="polite">
            <span
              className="font-pixel text-pixel-md transition-colors duration-300 motion-reduce:transition-none"
              style={{ color }}
            >
              {label}
            </span>
            {detail && <span className="font-pixel text-pixel-xs text-gray-400">{detail}</span>}
          </div>
          {cameraOn && (
            <PixelButton
              variant="tertiary"
              className="ml-auto shrink-0"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? "Hide preview" : "Show preview"}
            </PixelButton>
          )}
        </div>
      </div>
    </div>
  );
}
