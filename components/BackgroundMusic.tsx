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
        className="pixel-icon-btn fixed bottom-4 right-4 z-50 text-pixel-md bg-black/70 hover:bg-black/80"
        // Fill was black/50 with a rgba(255,255,255,.15) border — against
        // this button's real backdrops (dark pages vs. the light farm-page
        // canvas) the border measured 1.28–1.55:1 and the muted-state glyph
        // color (#6b7280) as low as 1.17:1. Bumped fill opacity so the
        // effective backdrop stays close to black regardless of what's
        // behind it (this sits over a live animated scene on /farm, so a
        // fixed contrast number against a moving background isn't
        // guaranteed otherwise) — .pixel-icon-btn's shared border then
        // clears 3:1+ in every real context.
        style={{ color: playing ? "#e5e7eb" : "#9ca3af" }}
      >
        {/* Musical note glyph (U+266A), not an emoji pictograph — dimmed
            when muted instead of swapping to a different symbol. */}
        <span aria-hidden="true">♪</span>
      </button>
    </>
  );
}
