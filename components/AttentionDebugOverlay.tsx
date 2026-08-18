"use client";

import { useSearchParams } from "next/navigation";
import type { AttentionState } from "@/lib/hooks/useAttention";

/**
 * Dev-only introspection panel for the attention detector — Phase 0's
 * whole point. Shown when `?debug=1` is in the URL, or always in
 * non-production builds (so local dev doesn't need the query param).
 * Deliberately plain: fixed-position monospace text, no design investment
 * — this is a diagnostic tool, not a feature.
 */
export default function AttentionDebugOverlay({
  attention,
}: {
  attention: AttentionState;
}) {
  const searchParams = useSearchParams();
  const forcedOn = searchParams.get("debug") === "1";
  const devDefault = process.env.NODE_ENV !== "production";
  if (!forcedOn && !devDefault) return null;

  const f = attention.debug.frame;

  const row = (label: string, value: string | number | boolean) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span>{typeof value === "number" ? value.toFixed(3) : String(value)}</span>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 60, // below the header nav, so it doesn't sit on top of real buttons
        left: 8,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.4,
        padding: "8px 10px",
        borderRadius: 4,
        minWidth: 220,
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ color: "#fff", fontWeight: "bold", marginBottom: 4 }}>
        attention debug
      </div>
      {row("verdict", attention.isFocused ? "FOCUSED" : "distracted")}
      {row("focusScore", attention.focusScore)}
      {row("reason", attention.distractedReason ?? "—")}
      {row("faceDetected", attention.faceDetected)}
      <div style={{ margin: "4px 0", opacity: 0.5 }}>── rate ──</div>
      {row("loopKind", attention.debug.loopKind ?? "—")}
      {row("rafHz", attention.debug.rafHz)}
      {row("cameraHz", attention.debug.cameraHz)}
      {!f ? (
        <div style={{ marginTop: 4, opacity: 0.6 }}>no frame data yet</div>
      ) : (
        <>
          <div style={{ margin: "4px 0", opacity: 0.5 }}>── raw ──</div>
          {row("yaw", f.rawYaw)}
          {row("pitch", f.rawPitch)}
          {row("ear", f.rawEar)}
          {row("gazeX", f.rawGazeX)}
          {row("gazeY", f.rawGazeY)}
          <div style={{ margin: "4px 0", opacity: 0.5 }}>── smoothed ──</div>
          {row("yaw", f.smoothedYaw)}
          {row("pitch", f.smoothedPitch)}
          {row("ear", f.smoothedEar)}
          {row("gazeX", f.smoothedGazeX)}
          {row("gazeY", f.smoothedGazeY)}
          <div style={{ margin: "4px 0", opacity: 0.5 }}>── derived ──</div>
          {row("roll", f.roll)}
          {row("worldDevX", f.worldDevX)}
          {row("worldDevY", f.worldDevY)}
          {row("worldDevMag", f.worldDevMag)}
          {row("headPoseMag", f.headPoseMag)}
          {row("eyesClosedInstant", f.eyesClosedInstant)}
          {row("isStall", f.isStall)}
          <div style={{ margin: "4px 0", opacity: 0.5 }}>── scores (Phase 3) ──</div>
          {row("eyeScore", f.eyeScore)}
          {row("headScore", f.headScore)}
          {row("gazeScore", f.gazeScore)}
          {row("focusScore", f.focusScore)}
          {row("distractStreakMs", f.distractStreakMs)}
          {row("focusStreakMs", f.focusStreakMs)}
          {row("noFaceMs", f.noFaceMs)}
          <div style={{ margin: "4px 0", opacity: 0.5 }}>── calibration ──</div>
          {row("earThreshold", f.earThreshold)}
          {row("progress", `${Math.round(f.calibrationProgress * 100)}%`)}
        </>
      )}
    </div>
  );
}
