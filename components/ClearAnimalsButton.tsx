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
      className="fixed bottom-20 right-4 z-50 font-pixel text-pixel-md rounded-full w-10 h-10 flex items-center justify-center bg-red-950/60 hover:bg-red-900/70 backdrop-blur transition-colors"
      style={{ border: "2px solid rgba(255,255,255,0.15)" }}
    >
      🗑
    </button>
  );
}
