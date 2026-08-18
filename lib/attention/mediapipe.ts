"use client";

/** Shared MediaPipe FaceLandmarker setup — used by both useAttention (live
 * detection) and useLandmarkStream (the /dev/record fixture recorder), so
 * they don't each hardcode their own copy of these URLs/quirks. */

export const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
export const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// MediaPipe's underlying TensorFlow Lite runtime emits messages like
// "INFO: Created TensorFlow Lite XNNPACK delegate for CPU." via the emscripten
// stderr → console.error pipeline. Next.js's dev error overlay treats every
// console.error as an error, so the user sees a scary modal for a benign log.
// We patch console.error once to demote those informational lines to console.info.
let consolePatched = false;
export function suppressMediaPipeInfoLogs() {
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
