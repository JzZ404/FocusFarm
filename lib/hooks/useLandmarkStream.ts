"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Landmark } from "@/lib/attention/classify";
import {
  MEDIAPIPE_WASM_URL,
  MODEL_URL,
  suppressMediaPipeInfoLogs,
} from "@/lib/attention/mediapipe";
import { scheduleVideoFrameLoop, type VideoFrameLoopHandle } from "@/lib/attention/videoFrameLoop";

/**
 * Raw landmark stream, no classification — used by /dev/record to capture
 * fixtures. Deliberately separate from useAttention: that hook exists to
 * produce a focused/distracted verdict, this one exists to hand every raw
 * frame to a caller-supplied sink (`onFrame`) so it can be buffered for a
 * JSON download, without also running (or being coupled to) the classifier.
 *
 * `onFrame` is called imperatively, not stored in React state — a 478-point
 * landmark array arriving 30-60 times/sec would be an expensive amount of
 * state churn for a page that mostly just needs to buffer it into a plain
 * array ref and show a live frame count.
 */
export interface LandmarkStreamState {
  isDetecting: boolean;
  faceDetected: boolean;
  frameCount: number;
  error: string | null;
}

interface FaceLandmarkerInstance {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number
  ) => { faceLandmarks: Landmark[][] };
  close?: () => void;
}

export function useLandmarkStream(
  videoRef: React.RefObject<HTMLVideoElement>,
  active: boolean,
  onFrame: (tMs: number, landmarks: Landmark[] | null) => void
): LandmarkStreamState {
  const [state, setState] = useState<LandmarkStreamState>({
    isDetecting: false,
    faceDetected: false,
    frameCount: 0,
    error: null,
  });

  const landmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const bootstrapRafRef = useRef<number | null>(null);
  const loopHandleRef = useRef<VideoFrameLoopHandle | null>(null);
  const mountedRef = useRef(true);
  const lastTimestampRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastVideoTimeRef = useRef<number | null>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame; // always call the latest closure without re-running the effect

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
      lastTimestampRef.current = 0;
      frameCountRef.current = 0;
      lastVideoTimeRef.current = null;
      setState({ isDetecting: false, faceDetected: false, frameCount: 0, error: null });
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

        const onVideoFrame = () => {
          if (cancelled || !mountedRef.current) return;
          const video = videoRef.current;
          if (!video || !landmarkerRef.current) return;

          // requestVideoFrameCallback (the normal path — see
          // lib/attention/videoFrameLoop.ts) already fires exactly once per
          // real camera frame, so no dedup is needed there. Only the
          // requestAnimationFrame fallback (no rVFC support) can still fire
          // faster than the camera delivers frames and needs the old
          // currentTime guard — this was the actual root cause of a real
          // "Invalid string length" crash on a long recording before this
          // fix existed; keep it for that one remaining path.
          if (loopHandleRef.current?.kind === "raf") {
            if (video.currentTime === lastVideoTimeRef.current) return;
            lastVideoTimeRef.current = video.currentTime;
          }

          try {
            const tNowMs = Math.max(performance.now(), lastTimestampRef.current + 1);
            lastTimestampRef.current = tNowMs;
            const results = landmarkerRef.current.detectForVideo(video, tNowMs);
            const landmarks = results?.faceLandmarks?.[0] ?? null;
            const faceDetected = !!landmarks && landmarks.length > 0;

            onFrameRef.current(tNowMs, faceDetected ? landmarks : null);
            frameCountRef.current += 1;

            if (mountedRef.current) {
              setState({
                isDetecting: true,
                faceDetected,
                frameCount: frameCountRef.current,
                error: null,
              });
            }
          } catch {
            // Skip frames that fail to detect; keep the loop alive.
          }
          // No manual re-schedule here — scheduleVideoFrameLoop's internal
          // tick already re-registers itself after calling this callback.
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

        setState((s) => ({ ...s, isDetecting: true, error: null }));
        waitForVideoReady();
      } catch {
        if (!cancelled && mountedRef.current) {
          setState((s) => ({
            ...s,
            isDetecting: false,
            error: "Landmark detection unavailable — check camera/model access.",
          }));
        }
      }
    }

    init();

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
