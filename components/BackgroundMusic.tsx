"use client";

import { useEffect, useRef, useState } from "react";

const VOLUME = 0.3;

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  // null = state unknown until first effect runs; true = playing, false = paused
  const [playing, setPlaying] = useState<boolean | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = VOLUME;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    // Try to autoplay. Modern browsers block this until a user gesture, so
    // we also wait for the first click / keypress and try again then.
    audio.play().catch(() => {});
    const kick = () => {
      audio.play().catch(() => {});
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
    window.addEventListener("pointerdown", kick);
    window.addEventListener("keydown", kick);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  return (
    <>
      <audio ref={audioRef} src="/audio/settling-in.mp3" loop preload="auto" />
      <button
        onClick={toggle}
        title={playing ? "Mute music" : "Play music"}
        aria-label={playing ? "Mute music" : "Play music"}
        className="fixed bottom-4 right-4 z-50 font-pixel text-pixel-md rounded-full w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/70 backdrop-blur transition-colors"
        style={{ border: "2px solid rgba(255,255,255,0.15)" }}
      >
        {playing ? "🎵" : "🔇"}
      </button>
    </>
  );
}
