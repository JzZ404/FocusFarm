"use client";

import { useFarm } from "@/context/FarmContext";

// Dev/testing convenience — wipes all placed animals with one click.
// Mirrors the existing circular icon-button pattern used by BackgroundMusic
// (same size/shape/backdrop-blur language) instead of a full text button,
// and is stacked above it (bottom-20 vs bottom-4) so the two don't overlap.
// Only rendered on the farm screen — mounted from app/farm/page.tsx, not
// the root layout, so it never shows on the starter menu or shop.
export default function ClearAnimalsButton() {
  const { farm, clearAnimals } = useFarm();

  function handleClick() {
    const count = farm.tiles.length;
    if (count === 0) return;
    const ok = window.confirm(
      `Delete all ${count} animal${count === 1 ? "" : "s"} from your farm?`
    );
    if (ok) clearAnimals();
  }

  return (
    <button
      onClick={handleClick}
      title="Clear all animals"
      aria-label="Clear all animals"
      // Fill was red-950/60 with the same low-contrast rgba(255,255,255,.15)
      // border as BackgroundMusic — bumped to /75 for the same reason (see
      // that component): keeps the effective backdrop dark and stable
      // regardless of the live farm scene behind it, so the shared
      // .pixel-icon-btn border and text-red-300 glyph both clear 3:1+/4.3:1+.
      className="pixel-icon-btn fixed bottom-20 right-4 z-50 text-pixel-md bg-red-950/75 hover:bg-red-900/80 text-red-300"
    >
      <span aria-hidden="true">&times;</span>
    </button>
  );
}
