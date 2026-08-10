"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PixelButton from "@/components/PixelButton";
import HowToPlayModal from "@/components/HowToPlayModal";
import WalkingAnimal from "@/components/WalkingAnimal";

export default function StartPage() {
  const router = useRouter();
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  return (
    <div
      className="flex flex-col items-center justify-center gap-16 px-6"
      style={{ height: "100dvh", background: "var(--farm-bg)" }}
    >
      {/* Logo asset (public/images/focusfarm-logo.png) — replaces the earlier
          CSS-built two-line title (text-pixel-3xl + text-pixel-stroke). That
          utility class stays in globals.css for reuse on other hero text;
          see DESIGN.md changelog. imageRendering: pixelated keeps the pixel
          art crisp when scaled, matching FarmCanvas's .pixelated pattern. */}
      <div className="relative w-full max-w-md">
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
      </div>

      <div className="flex flex-col items-stretch gap-4 w-full max-w-xs">
        <PixelButton size="lg" onClick={() => router.push("/farm")}>
          Start
        </PixelButton>
        <PixelButton
          variant="outline"
          size="lg"
          onClick={() => router.push("/shop")}
        >
          Shop
        </PixelButton>
        <PixelButton
          variant="outline"
          size="lg"
          onClick={() => setShowHowToPlay(true)}
        >
          How to Play
        </PixelButton>
      </div>

      {showHowToPlay && (
        <HowToPlayModal onClose={() => setShowHowToPlay(false)} />
      )}
    </div>
  );
}
