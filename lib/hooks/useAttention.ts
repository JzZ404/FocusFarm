"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  classifyFrame,
  createInitialAttentionState,
  DEFAULT_CONFIG,
  type AttentionConfig,
  type AttentionState as ClassifierState,
  type DistractionReason,
  type FrameDebug,
  type Landmark,
} from "@/lib/attention/classify";
import { MEDIAPIPE_WASM_URL, MODEL_URL, suppressMediaPipeInfoLogs } from "@/lib/attention/mediapipe";
import { scheduleVideoFrameLoop, type VideoFrameLoopHandle } from "@/lib/attention/videoFrameLoop";
import { applyCalibrationToConfig } from "@/lib/attention/neutralCalibration";
import { getAttentionCalibration } from "@/lib/storage";

// Re-exported so existing consumers (AttentionHUD, etc.) don't need to
// change their import path.
export type { DistractionReason, FrameDebug };

/** Dev-overlay-only info — cheap to always compute, only ever rendered
 * behind the debug overlay's own gate (see AttentionDebugOverlay). */
export interface AttentionDebugInfo {
  frame: FrameDebug | null;
  /** Detection loop tick rate. Since Phase 1, the loop is driven by
   * requestVideoFrameCallback (falling back to requestAnimationFrame only
   * on browsers without it — see lib/attention/videoFrameLoop.ts), so this
   * should now track cameraHz closely: both count the same real video
   * frames. Kept as a separate field (rather than collapsing into one) so
   * the fallback path — where the old rAF-vs-camera gap can still appear —
   * stays observable. */
  rafHz: number;
  /** Rate of distinct video.currentTime values observed — an approximation
   * of genuine camera frame delivery, independent of display refresh rate. */
  cameraHz: number;
  /** Which loop mechanism is actually active — "rvfc" is the Phase 1 path;
   * "raf" means requestVideoFrameCallback isn't available on this browser. */
  loopKind: "rvfc" | "raf" | null;
}

/** Public shape this hook returns — unchanged from before the Phase 0
 * classifier extraction (aside from the additive, optional `debug` field),
 * so no consumer (AttentionHUD, session/page.tsx, SessionContext) needed
 * to change. */
export interface AttentionState {
  isDetecting: boolean;
  isFocused: boolean;
  /** Continuous 0..1 attention estimate — Build Mandate Phase 3. Reward
   * accrual (context/SessionContext.tsx) integrates this over time;
   * isFocused above is kept for UI display only. */
  focusScore: number;
  faceDetected: boolean;
  /** Eye Aspect Ratio (eyelid openness), smoothed. Lower = more closed. */
  eyeAspectRatio: number;
  /** Smoothed head yaw. 0 = facing camera, roll-compensated. */
  headYaw: number;
  /** Smoothed head pitch. 0 = facing camera, positive = looking down. */
  headPitch: number;
  /** Smoothed horizontal iris offset from eye-socket center (head-relative). */
  gazeOffset: number;
  /** Smoothed vertical iris offset from eye-socket center (head-relative). */
  gazeOffsetVertical: number;
  /** Combined world-space gaze magnitude (head pose + iris offset, both axes). */
  worldGaze: number;
  distractedReason: DistractionReason;
  error: string | null;
  /** Populated whenever detection is running; consumed by AttentionDebugOverlay. */
  debug: AttentionDebugInfo;
}

/** Rolling-window Hz estimate: keeps timestamps from the last ~1s, reports
 * how many arrived in that window. Cheap (small bounded array), fine to
 * run unconditionally. */
function makeRateTracker(windowMs = 1000) {
  const timestamps: number[] = [];
  return {
    tick(tNowMs: number) {
      timestamps.push(tNowMs);
      while (timestamps.length > 0 && tNowMs - timestamps[0] > windowMs) {
        timestamps.shift();
      }
    },
    hz(): number {
      if (timestamps.length < 2) return 0;
      const spanMs = timestamps[timestamps.length - 1] - timestamps[0];
      return spanMs > 0 ? ((timestamps.length - 1) * 1000) / spanMs : 0;
    },
  };
}

/*
 * This hook is now a thin shell: it owns the camera/MediaPipe lifecycle,
 * the detection loop, and React state — all the detection MATH lives in
 * lib/attention/classify.ts's pure classifyFrame(), which this hook calls
 * once per frame and nothing else touches. See that file for the pipeline
 * diagram and the reasoning behind EAR + iris landmarks over blendshapes.
 *
 * Still requestAnimationFrame-driven in this phase (ties detection rate to
 * display refresh, not actual new camera frames — can run inference
 * redundantly on an unchanged frame on high-refresh displays). Phase 1
 * switched the loop to requestVideoFrameCallback (via the shared
 * lib/attention/videoFrameLoop.ts helper) to fix exactly that — see
 * AttentionDebugInfo.loopKind/rafHz/cameraHz for how to confirm it's active.
 */

interface FaceLandmarkerInstance {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number
  ) => { faceLandmarks: Landmark[][] };
  close?: () => void;
}

function toPublicState(
  base: {
    isDetecting: boolean;
    error: string | null;
  },
  result: {
    isFocused: boolean;
    focusScore: number;
    faceDetected: boolean;
    reason: DistractionReason;
    debug: FrameDebug;
  },
  debugInfo: AttentionDebugInfo
): AttentionState {
  return {
    isDetecting: base.isDetecting,
    isFocused: result.isFocused,
    focusScore: result.focusScore,
    faceDetected: result.faceDetected,
    eyeAspectRatio: result.debug.smoothedEar,
    headYaw: result.debug.smoothedYaw,
    headPitch: result.debug.smoothedPitch,
    gazeOffset: result.debug.smoothedGazeX,
    gazeOffsetVertical: result.debug.smoothedGazeY,
    worldGaze: result.debug.worldDevMag,
    distractedReason: result.reason,
    error: base.error,
    debug: debugInfo,
  };
}

export function useAttention(
  videoRef: React.RefObject<HTMLVideoElement>,
  active: boolean
): AttentionState {
  const [state, setState] = useState<AttentionState>({
    isDetecting: false,
    isFocused: false,
    focusScore: 0,
    faceDetected: false,
    eyeAspectRatio: 0,
    headYaw: 0,
    headPitch: 0,
    gazeOffset: 0,
    gazeOffsetVertical: 0,
    worldGaze: 0,
    distractedReason: null,
    error: null,
    debug: { frame: null, rafHz: 0, cameraHz: 0, loopKind: null },
  });

  const landmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  // The video-ready bootstrap poll (plain rAF, waiting for a video element
  // to exist and reach readyState>=2) is a separate mechanism from the real
  // detection loop below — see waitForVideoReady in the effect.
  const bootstrapRafRef = useRef<number | null>(null);
  const loopHandleRef = useRef<VideoFrameLoopHandle | null>(null);
  const mountedRef = useRef(true);

  // The pure classifier's own state, carried between frames — see
  // lib/attention/classify.ts. This hook never reaches into its fields.
  const classifierStateRef = useRef<ClassifierState>(createInitialAttentionState());
  // Build Mandate Phase 2: whatever neutral-pose calibration is persisted
  // in localStorage, merged into DEFAULT_CONFIG once per detection session
  // (not re-read every frame — recalibrating mid-session isn't a supported
  // flow; see the session UI's "Recalibrate" affordance, which runs before
  // a session starts, not during one). No persisted calibration (first-ever
  // use, or storage cleared) → applyCalibrationToConfig(config, null)
  // returns config unchanged, i.e. Phase 1's uncalibrated behavior.
  const configRef = useRef<AttentionConfig>(DEFAULT_CONFIG);

  // MediaPipe requires strictly increasing timestamps in VIDEO mode.
  // performance.now() can repeat across two animation frames on some browsers.
  const lastTimestampRef = useRef(0);
  const detectErrorLoggedRef = useRef(false);

  // Dev-overlay-only rate tracking — see AttentionDebugInfo above for why
  // there are two of these.
  const rafRateRef = useRef(makeRateTracker());
  const cameraRateRef = useRef(makeRateTracker());
  const lastVideoTimeRef = useRef<number | null>(null);

  const stopDetection = useCallback(() => {
    if (bootstrapRafRef.current !== null) {
      cancelAnimationFrame(bootstrapRafRef.current);
      bootstrapRafRef.current = null;
    }
    if (loopHandleRef.current) {
      loopHandleRef.current.cancel();
      loopHandleRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopDetection();
    };
  }, [stopDetection]);

  useEffect(() => {
    if (!active) {
      stopDetection();
      classifierStateRef.current = createInitialAttentionState();
      lastTimestampRef.current = 0;
      detectErrorLoggedRef.current = false;
      rafRateRef.current = makeRateTracker();
      cameraRateRef.current = makeRateTracker();
      lastVideoTimeRef.current = null;
      setState((s) => ({
        ...s,
        isDetecting: false,
        isFocused: false,
        focusScore: 0,
        faceDetected: false,
        distractedReason: null,
        debug: { frame: null, rafHz: 0, cameraHz: 0, loopKind: null },
      }));
      return;
    }

    let cancelled = false;
    // Read once per detection session, not per frame — see configRef's doc
    // comment above for why mid-session recalibration isn't handled here.
    configRef.current = applyCalibrationToConfig(DEFAULT_CONFIG, getAttentionCalibration());

    async function initMediaPipe() {
      try {
        suppressMediaPipeInfoLogs();
        const { FaceLandmarker, FilesetResolver } = await import(
          "@mediapipe/tasks-vision"
        );

        const filesetResolver = await FilesetResolver.forVisionTasks(
          MEDIAPIPE_WASM_URL
        );

        const landmarker = await FaceLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
          }
        );

        if (cancelled || !mountedRef.current) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;

        const onVideoFrame = () => {
          if (cancelled || !mountedRef.current) return;
          const video = videoRef.current;
          if (!video || !landmarkerRef.current) return;

          try {
            const tNowMs = Math.max(
              performance.now(),
              lastTimestampRef.current + 1
            );
            const dtMs =
              lastTimestampRef.current === 0 ? 0 : tNowMs - lastTimestampRef.current;
            lastTimestampRef.current = tNowMs;

            // Dev-overlay rate tracking. rafRate ticks every loop iteration.
            // cameraRate: with requestVideoFrameCallback active (the normal
            // Phase 1 path), every tick IS a new camera frame by
            // construction, so tick unconditionally — this rate should now
            // track rafRate closely, an observable proof the fix is live.
            // On the requestAnimationFrame fallback path (no rVFC support),
            // keep the old currentTime-dedup so the gap this was built to
            // reveal — rAF outrunning the camera on a high-refresh display —
            // still shows up there, where it can still happen.
            rafRateRef.current.tick(tNowMs);
            const usingRVFC = loopHandleRef.current?.kind === "rvfc";
            if (usingRVFC || lastVideoTimeRef.current !== video.currentTime) {
              lastVideoTimeRef.current = video.currentTime;
              cameraRateRef.current.tick(tNowMs);
            }

            const results = landmarkerRef.current.detectForVideo(video, tNowMs);
            const landmarks = results?.faceLandmarks?.[0] ?? null;
            // Same condition classifyFrame uses internally to pick its
            // no-face branch (`!landmarks || landmarks.length === 0`) — kept
            // in sync explicitly rather than inferred from `landmarks`
            // alone, since a technically-non-null-but-empty array should
            // still read as "no face" here too.
            const faceDetected = !!landmarks && landmarks.length > 0;

            const result = classifyFrame(
              landmarks,
              tNowMs,
              dtMs,
              classifierStateRef.current,
              configRef.current
            );
            classifierStateRef.current = result.state;

            if (mountedRef.current) {
              setState(
                toPublicState(
                  { isDetecting: true, error: null },
                  {
                    isFocused: result.isFocused,
                    focusScore: result.focusScore,
                    faceDetected,
                    reason: result.reason,
                    debug: result.debug,
                  },
                  {
                    frame: result.debug,
                    rafHz: rafRateRef.current.hz(),
                    cameraHz: cameraRateRef.current.hz(),
                    loopKind: loopHandleRef.current?.kind ?? null,
                  }
                )
              );
            }
          } catch (err) {
            // Skip frames that fail, but surface the first error so it's diagnosable.
            if (!detectErrorLoggedRef.current) {
              detectErrorLoggedRef.current = true;
              console.warn("[useAttention] detection error (subsequent suppressed):", err);
            }
          }
          // No manual re-schedule here — scheduleVideoFrameLoop's internal
          // tick already re-registers itself after calling this callback.
        };

        // Bootstrap: wait for a video element to exist and have data, then
        // hand off to the real per-frame loop exactly once — from then on
        // it re-schedules itself. (requestVideoFrameCallback itself would
        // happily wait for the first real frame if called earlier, but the
        // readyState<2 guard here is also what videoRef.current !== null
        // depends on, so keep both checks together for clarity.)
        const waitForVideoReady = () => {
          if (cancelled || !mountedRef.current) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2) {
            bootstrapRafRef.current = requestAnimationFrame(waitForVideoReady);
            return;
          }
          loopHandleRef.current = scheduleVideoFrameLoop(video, onVideoFrame);
        };

        setState((s) => ({ ...s, isDetecting: true, error: null }));
        waitForVideoReady();
      } catch {
        if (!cancelled && mountedRef.current) {
          setState((s) => ({
            ...s,
            error: "Attention detection unavailable. Running as manual timer.",
            isDetecting: false,
            isFocused: true, // manual-timer fallback when model can't load
            focusScore: 1, // matches isFocused: true — full credit, same "trust the user" fallback
            faceDetected: true,
            distractedReason: null,
          }));
        }
      }
    }

    initMediaPipe();

    return () => {
      cancelled = true;
      stopDetection();
      if (landmarkerRef.current) {
        landmarkerRef.current.close?.();
        landmarkerRef.current = null;
      }
    };
  }, [active, videoRef, stopDetection]);

  return state;
}
