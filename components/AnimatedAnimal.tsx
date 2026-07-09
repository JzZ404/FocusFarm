"use client";

import { FarmTile } from "@/lib/storage";
import { getItemById } from "@/data/shopItems";
import AnimalSprite from "./AnimalSprite";

const WANDER_CLASSES = ["anim-wander-a", "anim-wander-b", "anim-wander-c", "anim-wander-d", "anim-eat"] as const;

/** Deterministic "random" seed from a string */
function strHash(s: string): number {
  return s.split("").reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0x7fffffff, 0);
}

interface AnimatedAnimalProps {
  tile: FarmTile;
  tileSize: number;
}

export default function AnimatedAnimal({ tile, tileSize }: AnimatedAnimalProps) {
  const item = getItemById(tile.itemId);
  if (!item) return null;

  const seed = strHash(tile.id);
  const wanderClass = WANDER_CLASSES[seed % WANDER_CLASSES.length];
  const durationSec = 7 + (seed % 9);       // 7–15 s per cycle
  const delaySec = -(seed % durationSec);    // start mid-cycle so they're already moving

  const spriteSize = Math.round(tileSize * 0.82);
  // Place sprite centred in its home cell
  const left = tile.gridX * tileSize + (tileSize - spriteSize) / 2;
  const top  = tile.gridY * tileSize + (tileSize - spriteSize) / 2;

  return (
    <div
      className={`absolute pointer-events-none select-none ${wanderClass}`}
      style={{
        left,
        top,
        width: spriteSize,
        height: spriteSize,
        animationDuration: `${durationSec}s`,
        animationDelay: `${delaySec}s`,
        // painters-algorithm: lower animals appear in front
        zIndex: tile.gridY * 2 + 2,
      }}
      title={item.name}
    >
      <AnimalSprite
        sheet={item.sprite.sheet}
        pos={item.sprite.pos}
        size={spriteSize}
      />
    </div>
  );
}
