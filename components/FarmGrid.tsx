"use client";

import { useFarm } from "@/context/FarmContext";
import { getTileAt } from "@/lib/farmUtils";
import AnimatedAnimal from "./AnimatedAnimal";

const TILE_SIZE = 56;

// 4 grass colour variants per tile (Sprout-Lands-style)
const GRASS_COLORS = ["#6aaa35", "#72b43d", "#63a02e", "#78b840"];

// Decorations scattered on empty tiles (seeded, so stable on re-render)
const DECORATIONS = ["🌸", "🌼", "🌿", "🍀", "🪨", "🌱", "🌾", "💐"];

function tileSeed(x: number, y: number): number {
  return (x * 7 + y * 13 + x * y * 3 + 17) | 0;
}

function grassColor(x: number, y: number): string {
  return GRASS_COLORS[((x * 3 + y * 5) & 0xff) % GRASS_COLORS.length];
}

function tileDecoration(x: number, y: number): string | null {
  const s = tileSeed(x, y) % 16;
  if (s < 2) return DECORATIONS[s % DECORATIONS.length];
  return null;
}

export default function FarmGrid() {
  const { farm, pendingItemId, placeItem } = useFarm();
  const { gridWidth, gridHeight } = farm;
  const placementMode = !!pendingItemId;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: gridWidth * TILE_SIZE,
        height: gridHeight * TILE_SIZE,
        border: "4px solid #5a3e28",
        borderRadius: 4,
        boxShadow: "0 6px 32px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,0,0,0.12)",
        cursor: placementMode ? "crosshair" : "default",
      }}
    >
      {/* ── Background tile grid ─────────────────────────── */}
      <div
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${gridWidth}, ${TILE_SIZE}px)` }}
      >
        {Array.from({ length: gridHeight }).flatMap((_, row) =>
          Array.from({ length: gridWidth }).map((_, col) => {
            const occupied = !!getTileAt(farm, col, row);
            const deco = !occupied ? tileDecoration(col, row) : null;
            const bg = grassColor(col, row);

            return (
              <div
                key={`${col}-${row}`}
                onClick={() => placementMode && !occupied && placeItem(col, row)}
                style={{
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                  background: bg,
                  position: "relative",
                }}
              >
                {/* Subtle inner grid lines */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    boxShadow: "inset 1px 1px 0 rgba(0,0,0,0.06), inset -1px -1px 0 rgba(255,255,255,0.06)",
                    pointerEvents: "none",
                  }}
                />

                {/* Scattered decoration on empty tiles */}
                {deco && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 4,
                      right: 6,
                      fontSize: 12,
                      opacity: 0.55,
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    {deco}
                  </span>
                )}

                {/* Placement hover highlight */}
                {placementMode && !occupied && (
                  <div className="farm-tile-hover-overlay" />
                )}

                {/* Placement indicator ring */}
                {placementMode && !occupied && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 3,
                      border: "2px dashed rgba(74,222,128,0.45)",
                      borderRadius: 2,
                      pointerEvents: "none",
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Animated animals floating above the grid ────── */}
      {farm.tiles.map((tile) => (
        <AnimatedAnimal key={tile.id} tile={tile} tileSize={TILE_SIZE} />
      ))}
    </div>
  );
}
