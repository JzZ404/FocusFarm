"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWebcam } from "@/lib/hooks/useWebcam";
import { useLandmarkStream } from "@/lib/hooks/useLandmarkStream";
import type { Landmark } from "@/lib/attention/classify";

/**
 * Fixture recorder for the attention-detection replay harness (Build
 * Mandate Phase 0.4). Records raw landmarks + human-pressed label markers
 * to a downloadable JSON file — see docs/attention-baseline.md for what
 * happens to the file after that.
 *
 * Not meant for end users: gated behind a runtime NODE_ENV check rather
 * than excluded from the route tree, since Next.js doesn't have a simple
 * way to drop a page from the production build entirely without extra
 * tooling, and a runtime guard is sufficient for a page nobody will link to.
 */

type LabelName = "focused" | "phone" | "looking_away" | "eyes_closed" | "absent";

const LABEL_KEYS: Record<string, LabelName> = {
  "1": "focused",
  "2": "phone",
  "3": "looking_away",
  "4": "eyes_closed",
  "5": "absent",
};

interface LabelMarker {
  t: number;
  label: LabelName;
}

/** `z` is dropped and x/y rounded before storing — see COORD_DECIMALS below.
 * classifyFrame never reads landmark.z (verified: no formula in
 * lib/attention/classify.ts touches it), so keeping it in every one of ~478
 * points × thousands of frames was pure fixture-size waste with no
 * information behind it. scripts/replay.ts re-adds z: 0 when loading. */
export type RecordedLandmark = { x: number; y: number };

interface RecordedFrame {
  t: number;
  landmarks: RecordedLandmark[] | null;
}

const COORD_DECIMALS = 5; // normalized [0,1] coords — 5 decimals is sub-pixel at any real camera resolution
const ROUND_FACTOR = 10 ** COORD_DECIMALS;
function roundCoord(n: number): number {
  return Math.round(n * ROUND_FACTOR) / ROUND_FACTOR;
}
function trimLandmarks(landmarks: Landmark[] | null): RecordedLandmark[] | null {
  if (!landmarks) return null;
  return landmarks.map((p) => ({ x: roundCoord(p.x), y: roundCoord(p.y) }));
}

export default function RecordPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <div className="min-h-screen flex items-center justify-center font-pixel text-pixel-sm text-gray-400">
        Not available in production.
      </div>
    );
  }
  return <RecordPageInner />;
}

function RecordPageInner() {
  const webcam = useWebcam();
  const [isRecording, setIsRecording] = useState(false);
  const [labelMarkers, setLabelMarkers] = useState<LabelMarker[]>([]);
  const [currentLabel, setCurrentLabel] = useState<LabelName | null>(null);
  const [downloadableFrameCount, setDownloadableFrameCount] = useState(0);

  const framesRef = useRef<RecordedFrame[]>([]);
  const recordingStartRef = useRef(0);

  const handleFrame = useCallback(
    (tMs: number, landmarks: Landmark[] | null) => {
      framesRef.current.push({
        t: tMs - recordingStartRef.current,
        landmarks: trimLandmarks(landmarks),
      });
    },
    []
  );

  const stream = useLandmarkStream(webcam.videoRef, isRecording, handleFrame);

  const startRecording = useCallback(async () => {
    if (webcam.status !== "active") {
      const granted = await webcam.requestCamera();
      if (!granted) return;
    }
    framesRef.current = [];
    recordingStartRef.current = performance.now();
    setLabelMarkers([]);
    setCurrentLabel(null);
    setDownloadableFrameCount(0);
    setIsRecording(true);
  }, [webcam]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setDownloadableFrameCount(framesRef.current.length);
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    function onKeyDown(e: KeyboardEvent) {
      const label = LABEL_KEYS[e.key];
      if (!label) return;
      const t = performance.now() - recordingStartRef.current;
      setLabelMarkers((prev) => [...prev, { t, label }]);
      setCurrentLabel(label);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isRecording]);

  function downloadJson() {
    // A long recording's `frames` array is too big for a single
    // JSON.stringify() call — that's exactly what threw "Invalid string
    // length" on a real recording (V8 caps how long one JS string can be,
    // ~500MB+; several thousand frames × ~478 landmarks each gets there
    // fast). Blob's constructor accepts an array of many small string
    // parts and assembles the file from those directly, without ever
    // forming one JS string of the total size — so build the same JSON
    // document (still one valid `{label_markers:...,frames:[...]}` file,
    // nothing downstream needs to change) out of per-frame pieces instead.
    const parts: BlobPart[] = [
      '{"label_markers":',
      JSON.stringify(labelMarkers),
      ',"frames":[',
    ];
    const frames = framesRef.current;
    for (let i = 0; i < frames.length; i++) {
      if (i > 0) parts.push(",");
      parts.push(JSON.stringify(frames[i]));
    }
    parts.push("]}");

    const blob = new Blob(parts, { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `attention-fixture-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const hasFrames = isRecording
    ? framesRef.current.length > 0
    : downloadableFrameCount > 0;

  return (
    <div
      className="min-h-screen flex flex-col items-center gap-6 p-6 font-pixel text-pixel-sm text-gray-200"
      style={{ background: "#1a2e1a" }}
    >
      <h1 className="text-pixel-lg text-white">Attention Fixture Recorder</h1>

      <div className="pixel-panel p-4 max-w-md text-center text-pixel-xs text-gray-400 leading-relaxed">
        Press <strong className="text-yellow-300">Start Recording</strong>, then act
        out each behavior while pressing its number key. The label applies to every
        frame until you press a different key.
        <div className="mt-3 flex flex-col gap-1 text-left">
          <span><strong className="text-green-300">1</strong> = focused</span>
          <span><strong className="text-green-300">2</strong> = phone (looking down)</span>
          <span><strong className="text-green-300">3</strong> = looking_away</span>
          <span><strong className="text-green-300">4</strong> = eyes_closed</span>
          <span><strong className="text-green-300">5</strong> = absent</span>
        </div>
      </div>

      <video
        ref={webcam.videoRef}
        autoPlay
        muted
        playsInline
        className="rounded-lg"
        style={{ width: 320, height: 240, transform: "scaleX(-1)", background: "#000" }}
      />

      {webcam.error && (
        <div className="text-pixel-xs text-red-400">{webcam.error}</div>
      )}
      {stream.error && (
        <div className="text-pixel-xs text-red-400">{stream.error}</div>
      )}

      <div className="flex flex-col items-center gap-1 text-pixel-xs">
        <div>
          camera: <span className="text-gray-300">{webcam.status}</span> · detecting:{" "}
          <span className="text-gray-300">{String(stream.isDetecting)}</span> · face:{" "}
          <span className={stream.faceDetected ? "text-green-300" : "text-red-400"}>
            {String(stream.faceDetected)}
          </span>
        </div>
        <div>
          frames recorded:{" "}
          <span className="text-yellow-300">{stream.frameCount}</span> · labels marked:{" "}
          <span className="text-yellow-300">{labelMarkers.length}</span>
        </div>
        <div>
          current label:{" "}
          <span className="text-green-300">
            {isRecording ? currentLabel ?? "(none yet — press a number key)" : "—"}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="pixel-btn"
          >
            Start Recording
          </button>
        ) : (
          <button onClick={stopRecording} className="pixel-btn pixel-btn-danger">
            Stop Recording
          </button>
        )}
        <button
          onClick={downloadJson}
          disabled={!hasFrames}
          className="pixel-btn pixel-btn-outline"
        >
          Download JSON
        </button>
      </div>

      <div className="text-pixel-xs text-gray-500 max-w-md text-center">
        Downloads go to your browser&apos;s normal download folder — move the file
        into <code className="text-gray-300">fixtures/attention/</code> in the repo
        afterward.
      </div>
    </div>
  );
}
