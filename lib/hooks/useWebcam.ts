"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type WebcamStatus = "idle" | "requesting" | "active" | "denied" | "error";

export interface WebcamState {
  status: WebcamStatus;
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  error: string | null;
  requestCamera: () => Promise<boolean>;
  stopCamera: () => void;
}

export function useWebcam(): WebcamState {
  const [status, setStatus] = useState<WebcamStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStream(null);
    setStatus("idle");
  }, []);

  const requestCamera = useCallback(async (): Promise<boolean> => {
    setStatus("requesting");
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = s;
      setStream(s);
      setStatus("active");
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      return true;
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access and refresh."
          : "Could not access camera. Please check your device.";
      setError(msg);
      setStatus("denied");
      return false;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (stream && videoRef.current && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return { status, stream, videoRef, error, requestCamera, stopCamera };
}
