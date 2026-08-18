"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PixelButton from "@/components/PixelButton";
import HowToPlayModal from "@/components/HowToPlayModal";
import WalkingAnimal from "@/components/WalkingAnimal";
import StartMenuBackground from "@/components/StartMenuBackground";

export default function StartPage() {
  const router = useRouter();
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  return (
    // <main>, not <div> — gives screen-reader users a landmark to jump
    // straight to the page's primary content instead of tabbing/reading
    // through everything from the top.
    <main
      className="relative isolate flex flex-col items-center justify-center gap-16 px-6"
      // relative+isolate: gives this div its own stacking context so the
      // background canvas (position:absolute, z-index:-10 inside it) stacks
      // behind this div's own children but still above this div's own
      // background paint. Without isolate, a fixed/negative-z descendant of
      // a non-positioned div escapes to the ROOT stacking context and ends
      // up painted behind this div's background entirely — invisible.
      // #a9d3e6 (sky-top blue) is the fallback shown for the instant before
      // StartMenuBackground's scripts load and paint — matches its
      // gradient's top color so there's no dark-green flash under the sky.
      style={{ height: "100dvh", background: "#a9d3e6" }}
    >
      <StartMenuBackground />
      {/* Logo asset (public/images/focusfarm-logo.png) — replaces the earlier
          CSS-built two-line title (text-pixel-3xl + text-pixel-stroke). That
          utility class stays in globals.css for reuse on other hero text;
          see DESIGN.md changelog. imageRendering: pixelated keeps the pixel
          art crisp when scaled, matching FarmCanvas's .pixelated pattern.
          Wrapped in an <h1> (not just a bare <img>) so the page has a real
          heading landmark — Tailwind's preflight zeroes h1's default
          margin/font-size, so this is a no-op visually, purely structural. */}
      <h1 className="relative w-full max-w-md m-0">
        <img
          src="/images/focusfarm-logo.png"
          alt="FocusFarm"
          className="w-full block"
          style={{ imageRendering: "pixelated" }}
        />
        {/* Chicken walks along the top edge of the logo image itself — band
            shifted so its feet land right at the image's top border (y=0).
            marginRight is wider than marginLeft so it turns around before
            walking off the right end of the "Focus" text. Patrols to a
            random point within its range each leg, not a fixed bounce
            edge-to-edge, so turnaround spots vary. Starter menu header
            only, not the farm scene. */}
        <div className="absolute inset-x-0" style={{ top: -64, height: 64 }}>
          <WalkingAnimal species="chicken" displayHeight={64} marginLeft={18} marginRight={70} />
        </div>
      </h1>

      <div className="flex flex-col items-stretch gap-4 w-full max-w-xs">
        <PixelButton size="lg" onScene onClick={() => router.push("/farm")}>
          Start
        </PixelButton>
        <PixelButton
          variant="outline"
          size="lg"
          onScene
          onClick={() => router.push("/shop")}
        >
          Shop
        </PixelButton>
        <PixelButton
          variant="outline"
          size="lg"
          onScene
          onClick={() => setShowHowToPlay(true)}
        >
          How to Play
        </PixelButton>
      </div>

      {showHowToPlay && (
        <HowToPlayModal onClose={() => setShowHowToPlay(false)} />
      )}
    </main>
  );
}
