/**
 * Frame-rate-independent video loop scheduling — Build Mandate Phase 1.
 *
 * requestAnimationFrame fires once per display repaint, not once per actual
 * new camera frame: on a display refreshing faster than the camera delivers
 * frames (e.g. a 120Hz laptop screen with a 30fps webcam), it runs
 * inference redundantly on the same unchanged video frame multiple times.
 * That's what made frame-count-based hysteresis/smoothing rate-dependent
 * (see lib/attention/classify.ts's header — Phase 1 fixed the math side of
 * this) and, before a dedup guard was added as an interim fix, is what made
 * /dev/record capture duplicate landmark data and blow past the JS
 * string-length ceiling on long recordings.
 *
 * requestVideoFrameCallback fires exactly once per decoded video frame
 * actually presented to the compositor — the real fix for both. Both
 * useAttention and useLandmarkStream schedule their detection loop through
 * this one helper so the feature-detection/fallback/cancellation logic
 * exists in exactly one place rather than being copied twice.
 */

export interface VideoFrameLoopHandle {
  cancel(): void;
  /** Which mechanism is actually driving this loop. Exposed for the debug
   * overlay: with "rvfc" active, loop-tick rate and genuine camera-frame
   * rate should converge (see AttentionDebugInfo's rafHz vs cameraHz doc
   * comment) — that convergence is an observable proof this fix is live.
   * "raf" means requestVideoFrameCallback isn't available (older Safari)
   * and the loop fell back to the pre-Phase-1 mechanism. */
  kind: "rvfc" | "raf";
}

type FrameCallback = () => void;

function hasRVFC(video: HTMLVideoElement): boolean {
  return typeof video.requestVideoFrameCallback === "function";
}

/**
 * Schedules `callback` to run once per real video frame, self-rescheduling
 * after every call until `.cancel()` is called. Falls back to
 * requestAnimationFrame (matching pre-Phase-1 behavior) on browsers without
 * requestVideoFrameCallback.
 *
 * Only call this once video data actually exists — requestVideoFrameCallback
 * simply waits for the first real frame if called earlier, so callers don't
 * need their own "is the video ready yet" poll once they've handed off to
 * this loop; they only need one before calling it the first time (see
 * useAttention.ts/useLandmarkStream.ts's waitForVideoReady).
 */
export function scheduleVideoFrameLoop(
  video: HTMLVideoElement,
  callback: FrameCallback
): VideoFrameLoopHandle {
  if (hasRVFC(video)) {
    let handle: number;
    const tick = () => {
      callback();
      handle = video.requestVideoFrameCallback(tick);
    };
    handle = video.requestVideoFrameCallback(tick);
    return {
      kind: "rvfc",
      cancel: () => video.cancelVideoFrameCallback(handle),
    };
  }

  let handle: number;
  const tick = () => {
    callback();
    handle = requestAnimationFrame(tick);
  };
  handle = requestAnimationFrame(tick);
  return {
    kind: "raf",
    cancel: () => cancelAnimationFrame(handle),
  };
}
