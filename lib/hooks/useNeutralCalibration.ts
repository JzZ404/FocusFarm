"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeRawSignals,
  DEFAULT_CONFIG,
  type Landmark,
} from "@/lib/attention/classify";
import {
  createCalibrationSampler,
  addSample,
  finalizeCalibration,
  NEUTRAL_CALIB_DURATION_MS,
  type CalibrationSampler,
  type NeutralCalibration,
} from "@/lib/attention/neutralCalibration";
import {
  MEDIAPIPE_WASM_URL,
  MODEL_URL,
  suppressMediaPipeInfoLogs,
} from "@/lib/attention/mediapipe";
import { scheduleVideoFrameLoop, type VideoFrameLoopHandle } from "@/lib/attention/videoFrameLoop";

/**
 * Runs a short "look at the center of your screen and hold still" capture
 * (see NEUTRAL_CALIB_DURATION_MS) and produces a NeutralCalibration — the
 * onboarding step Build Mandate Phase 2 calls for. Deliberately separate
 * from useAttention (own MediaPipe instance, own loop) rather than adding
 * a "calibrating" mode to that already-busy hook — same reasoning
 * useLandmarkStream was kept separate from it: different job, different
 * lifecycle, simpler to reason about apart.
 *
 * Retries automatically (fresh window, same duration) whenever a capture
 * doesn't qualify — see finalizeCalibration's sigma-too-large/not-enough-
 * samples checks — surfacing the reason in `retryReason` so the caller's
 * UI can show live guidance instead of a silent spinner. `retry()` is also
 * exposed for a manual restart (e.g. after `status === "error"`, which
 * auto-retry doesn't recover from on its own, or just to let a user
 * restart early).
 */
export type NeutralCalibrationStatus = "idle" | "sampling" | "ok" | "retry" | "error";

export interface NeutralCalibrationState {
  status: NeutralCalibrationStatus;
  /** 0..1, only meaningful while status === "sampling". */
  progress: number;
  calibration: NeutralCalibration | null;
  retryReason: string | null;
  error: string | null;
}

interface FaceLandmarkerInstance {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number
  ) => { faceLandmarks: Landmark[][] };
  close?: () => void;
}

const INITIAL_STATE: NeutralCalibrationState = {
  status: "idle",
  progress: 0,
  calibration: null,
  retryReason: null,
  error: null,
};

export function useNeutralCalibration(
  videoRef: React.RefObject<HTMLVideoElement>,
  active: boolean
): NeutralCalibrationState & { retry: () => void } {
  const [state, setState] = useState<NeutralCalibrationState>(INITIAL_STATE);

  const landmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const bootstrapRafRef = useRef<number | null>(null);
  const loopHandleRef = useRef<VideoFrameLoopHandle | null>(null);
  const mountedRef = useRef(true);
  const samplerRef = useRef<CalibrationSampler>(createCalibrationSampler());
  const windowStartRef = useRef<number | null>(null);
  const lastTimestampRef = useRef(0);

  const stopLoop = useCallback(() => {
    if (bootstrapRafRef.current !== null) {
      cancelAnimationFrame(bootstrapRafRef.current);
      bootstrapRafRef.current = null;
    }
    if (loopHandleRef.current) {
      loopHandleRef.current.cancel();
      loopHandleRef.current = null;
    }
  }, []);

  const startWindow = useCallback(() => {
    samplerRef.current = createCalibrationSampler();
    windowStartRef.current = null; // anchored on the next real frame
    setState((s) => ({ ...s, status: "sampling", progress: 0, retryReason: null }));
  }, []);

  const retry = useCallback(() => {
    startWindow();
  }, [startWindow]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopLoop();
    };
  }, [stopLoop]);

  useEffect(() => {
    if (!active) {
      stopLoop();
      setState(INITIAL_STATE);
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        suppressMediaPipeInfoLogs();
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const filesetResolver = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
        if (cancelled || !mountedRef.current) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        startWindow();

        const onVideoFrame = () => {
          if (cancelled || !mountedRef.current || !landmarkerRef.current) return;
          const video = videoRef.current;
          if (!video) return;

          try {
            const tNowMs = Math.max(performance.now(), lastTimestampRef.current + 1);
            lastTimestampRef.current = tNowMs;
            if (windowStartRef.current === null) windowStartRef.current = tNowMs;

            const results = landmarkerRef.current.detectForVideo(video, tNowMs);
            const landmarks = results?.faceLandmarks?.[0] ?? null;
            if (landmarks && landmarks.length > 0) {
              const raw = computeRawSignals(landmarks, DEFAULT_CONFIG.earClosedThresholdDefault);
              samplerRef.current = addSample(samplerRef.current, raw);
            }

            const elapsed = tNowMs - windowStartRef.current;
            const progress = Math.min(1, elapsed / NEUTRAL_CALIB_DURATION_MS);

            if (elapsed < NEUTRAL_CALIB_DURATION_MS) {
              if (mountedRef.current) setState((s) => ({ ...s, status: "sampling", progress }));
              return;
            }

            const result = finalizeCalibration(samplerRef.current, tNowMs);
            if (result.status === "ok") {
              if (mountedRef.current) {
                setState({
                  status: "ok",
                  progress: 1,
                  calibration: result.calibration,
                  retryReason: null,
                  error: null,
                });
              }
            } else {
              if (mountedRef.current) {
                setState({
                  status: "retry",
                  progress: 1,
                  calibration: null,
                  retryReason: result.reason,
                  error: null,
                });
              }
              // Fresh window, automatically — surfacing retryReason is the
              // UX here, not a hard stop the user has to manually dismiss.
              samplerRef.current = createCalibrationSampler();
              windowStartRef.current = null;
            }
          } catch {
            if (mountedRef.current) {
              setState((s) => ({ ...s, status: "error", error: "Calibration detection error." }));
            }
          }
        };

        const waitForVideoReady = () => {
          if (cancelled || !mountedRef.current) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2) {
            bootstrapRafRef.current = requestAnimationFrame(waitForVideoReady);
            return;
          }
          loopHandleRef.current = scheduleVideoFrameLoop(video, onVideoFrame);
        };
        waitForVideoReady();
      } catch {
        if (!cancelled && mountedRef.current) {
          setState((s) => ({
            ...s,
            status: "error",
            error: "Calibration unavailable — camera or model failed to load.",
          }));
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      stopLoop();
      if (landmarkerRef.current) {
        landmarkerRef.current.close?.();
        landmarkerRef.current = null;
      }
    };
  }, [active, videoRef, stopLoop, startWindow]);

  return { ...state, retry };
}
