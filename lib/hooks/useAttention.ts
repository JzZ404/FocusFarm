"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DistractionReason =
  | "eyes_closed"
  | "looking_away"
  | "head_extreme"
  | "no_face"
  | null;

export interface AttentionState {
  isDetecting: boolean;
  isFocused: boolean;
  faceDetected: boolean;
  eyeAspectRatio: number;
  /** Normalized head yaw. 0 = facing camera. */
  headYaw: number;
  /** Averaged normalized iris offset from eye center. 0 = iris centered in socket. */
  gazeOffset: number;
  /**
   * Combined world-space gaze magnitude (head + iris). 0 = looking at screen
   * even if head is turned but eyes compensate.
   */
  worldGaze: number;
  distractedReason: DistractionReason;
  error: string | null;
}

// === Tunable thresholds ===
const EAR_CLOSED_THRESHOLD = 0.25;     // EAR below this → eyes closed or drooped (looking down)
const EYES_CLOSED_GRACE_MS = 1500;     // eyes can be closed this long without counting as distracted (blink tolerance)
const WORLD_GAZE_DEADZONE = 0.30;      // |head + iris| above this → gaze not on screen
const HEAD_YAW_HARD_LIMIT = 0.75;      // |yaw| above this → face too profile for landmarks to be trustworthy
const FRAMES_TO_DISTRACT = 6;          // sustained "bad" frames before flipping to distracted
const FRAMES_TO_REFOCUS = 4;           // sustained "good" frames before flipping back

const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// MediaPipe's underlying TensorFlow Lite runtime emits messages like
// "INFO: Created TensorFlow Lite XNNPACK delegate for CPU." via the emscripten
// stderr → console.error pipeline. Next.js's dev error overlay treats every
// console.error as an error, so the user sees a scary modal for a benign log.
// We patch console.error once to demote those informational lines to console.info.
let consolePatched = false;
function suppressMediaPipeInfoLogs() {
  if (consolePatched || typeof window === "undefined") return;
  consolePatched = true;
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && /^(INFO|WARNING|W\d{4})[:\s]/i.test(first)) {
      console.info(...args);
      return;
    }
    originalError(...args);
  };
}

// MediaPipe 478-point face mesh indices.
// Eye-corner indices double as the outer EAR landmarks.
const RIGHT_EYE_EAR = [33, 160, 158, 133, 153, 144];
const LEFT_EYE_EAR = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE_CORNERS = { outer: 33, inner: 133 };
const LEFT_EYE_CORNERS = { outer: 263, inner: 362 };
const RIGHT_IRIS_CENTER = 468;
const LEFT_IRIS_CENTER = 473;
const NOSE_TIP = 1;
const FACE_LEFT_EDGE = 234;
const FACE_RIGHT_EDGE = 454;

interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

interface FaceLandmarkerInstance {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number
  ) => { faceLandmarks: LandmarkPoint[][] };
  close?: () => void;
}

function dist2D(a: LandmarkPoint, b: LandmarkPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function computeEAR(landmarks: LandmarkPoint[], indices: number[]): number {
  const [p1, p2, p3, p4, p5, p6] = indices.map((i) => landmarks[i]);
  const vertical = (dist2D(p2, p6) + dist2D(p3, p5)) / 2;
  const horizontal = dist2D(p1, p4);
  return horizontal > 0 ? vertical / horizontal : 0;
}

/** ~0 facing camera; ±1 when nose hits a cheek edge. */
function computeHeadYaw(landmarks: LandmarkPoint[]): number {
  const nose = landmarks[NOSE_TIP];
  const left = landmarks[FACE_LEFT_EDGE];
  const right = landmarks[FACE_RIGHT_EDGE];
  const faceWidth = right.x - left.x;
  if (faceWidth <= 0) return 0;
  const center = (left.x + right.x) / 2;
  return (nose.x - center) / (faceWidth / 2);
}

/** ~0 when this eye is looking forward; sign matches iris displacement direction. */
function computeEyeGazeOffset(
  landmarks: LandmarkPoint[],
  corners: { outer: number; inner: number },
  irisCenter: number
): number {
  const outer = landmarks[corners.outer];
  const inner = landmarks[corners.inner];
  const iris = landmarks[irisCenter];
  if (!iris) return 0;
  const eyeCenterX = (outer.x + inner.x) / 2;
  const eyeWidth = Math.abs(inner.x - outer.x);
  if (eyeWidth <= 0) return 0;
  return (iris.x - eyeCenterX) / eyeWidth;
}

export function useAttention(
  videoRef: React.RefObject<HTMLVideoElement>,
  active: boolean
): AttentionState {
  const [state, setState] = useState<AttentionState>({
    isDetecting: false,
    isFocused: false,
    faceDetected: false,
    eyeAspectRatio: 0,
    headYaw: 0,
    gazeOffset: 0,
    worldGaze: 0,
    distractedReason: null,
    error: null,
  });

  const landmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Hysteresis state — refs so per-frame updates don't trigger re-renders.
  const distractCounterRef = useRef(0);
  const focusCounterRef = useRef(0);
  const focusedRef = useRef(false);
  // Timestamp (performance.now ms) when eyes first went closed; null when open.
  // Used to distinguish blinks from sustained eye closure.
  const eyesClosedSinceRef = useRef<number | null>(null);
  // MediaPipe requires strictly increasing timestamps in VIDEO mode.
  // performance.now() can repeat across two animation frames on some browsers.
  const lastTimestampRef = useRef(0);
  const detectErrorLoggedRef = useRef(false);

  const stopDetection = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
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
      distractCounterRef.current = 0;
      focusCounterRef.current = 0;
      focusedRef.current = false;
      eyesClosedSinceRef.current = null;
      lastTimestampRef.current = 0;
      detectErrorLoggedRef.current = false;
      setState((s) => ({
        ...s,
        isDetecting: false,
        isFocused: false,
        faceDetected: false,
        distractedReason: null,
      }));
      return;
    }

    let cancelled = false;

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

        const detect = () => {
          if (cancelled || !mountedRef.current) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(detect);
            return;
          }

          try {
            if (!landmarkerRef.current) return;
            const timestamp = Math.max(
              performance.now(),
              lastTimestampRef.current + 1
            );
            lastTimestampRef.current = timestamp;
            const results = landmarkerRef.current.detectForVideo(
              video,
              timestamp
            );
            const landmarks = results?.faceLandmarks?.[0];

            if (!landmarks || landmarks.length === 0) {
              distractCounterRef.current = Math.min(
                distractCounterRef.current + 1,
                FRAMES_TO_DISTRACT
              );
              focusCounterRef.current = 0;
              if (distractCounterRef.current >= FRAMES_TO_DISTRACT) {
                focusedRef.current = false;
              }
              if (mountedRef.current) {
                setState({
                  isDetecting: true,
                  isFocused: focusedRef.current,
                  faceDetected: false,
                  eyeAspectRatio: 0,
                  headYaw: 0,
                  gazeOffset: 0,
                  worldGaze: 0,
                  distractedReason: focusedRef.current ? null : "no_face",
                  error: null,
                });
              }
              rafRef.current = requestAnimationFrame(detect);
              return;
            }

            const leftEAR = computeEAR(landmarks, LEFT_EYE_EAR);
            const rightEAR = computeEAR(landmarks, RIGHT_EYE_EAR);
            const ear = (leftEAR + rightEAR) / 2;
            const yaw = computeHeadYaw(landmarks);
            const rightGaze = computeEyeGazeOffset(
              landmarks,
              RIGHT_EYE_CORNERS,
              RIGHT_IRIS_CENTER
            );
            const leftGaze = computeEyeGazeOffset(
              landmarks,
              LEFT_EYE_CORNERS,
              LEFT_IRIS_CENTER
            );
            const gaze = (rightGaze + leftGaze) / 2;

            // Track eye-closure duration so brief blinks don't count as distracted.
            const now = performance.now();
            const eyesClosed = ear < EAR_CLOSED_THRESHOLD;
            if (eyesClosed) {
              if (eyesClosedSinceRef.current === null) eyesClosedSinceRef.current = now;
            } else {
              eyesClosedSinceRef.current = null;
            }
            const eyesClosedMs =
              eyesClosedSinceRef.current === null ? 0 : now - eyesClosedSinceRef.current;
            const eyesClosedTooLong = eyesClosedMs > EYES_CLOSED_GRACE_MS;

            // World gaze = head pose + iris offset. When head turns one way and
            // eyes compensate the other way, these cancel and the user is still
            // looking at the screen. When eyes leave the screen (regardless of
            // head pose), the two signs reinforce and the magnitude grows.
            // During a blink, iris landmarks are unreliable — treat as on-screen.
            const worldGaze = eyesClosed ? 0 : yaw + gaze;

            const headExtreme = Math.abs(yaw) > HEAD_YAW_HARD_LIMIT;
            const lookingAway = Math.abs(worldGaze) > WORLD_GAZE_DEADZONE;

            let reason: DistractionReason = null;
            if (eyesClosedTooLong) reason = "eyes_closed";
            else if (headExtreme) reason = "head_extreme";
            else if (lookingAway) reason = "looking_away";

            const frameOK = !eyesClosedTooLong && !headExtreme && !lookingAway;

            if (frameOK) {
              focusCounterRef.current = Math.min(
                focusCounterRef.current + 1,
                FRAMES_TO_REFOCUS
              );
              distractCounterRef.current = 0;
              if (focusCounterRef.current >= FRAMES_TO_REFOCUS) {
                focusedRef.current = true;
              }
            } else {
              distractCounterRef.current = Math.min(
                distractCounterRef.current + 1,
                FRAMES_TO_DISTRACT
              );
              focusCounterRef.current = 0;
              if (distractCounterRef.current >= FRAMES_TO_DISTRACT) {
                focusedRef.current = false;
              }
            }

            if (mountedRef.current) {
              setState({
                isDetecting: true,
                isFocused: focusedRef.current,
                faceDetected: true,
                eyeAspectRatio: ear,
                headYaw: yaw,
                gazeOffset: gaze,
                worldGaze,
                distractedReason: focusedRef.current ? null : reason,
                error: null,
              });
            }
          } catch (err) {
            // Skip frames that fail, but surface the first error so it's diagnosable.
            if (!detectErrorLoggedRef.current) {
              detectErrorLoggedRef.current = true;
              console.warn("[useAttention] detection error (subsequent suppressed):", err);
            }
          }

          rafRef.current = requestAnimationFrame(detect);
        };

        setState((s) => ({ ...s, isDetecting: true, error: null }));
        detect();
      } catch {
        if (!cancelled && mountedRef.current) {
          setState((s) => ({
            ...s,
            error: "Attention detection unavailable. Running as manual timer.",
            isDetecting: false,
            isFocused: true, // manual-timer fallback when model can't load
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
