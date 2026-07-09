"use client";

import { getItemById } from "@/data/shopItems";
import { FarmTile as FarmTileType } from "@/lib/storage";
import AnimalSprite from "./AnimalSprite";

interface FarmTileProps {
  tile: FarmTileType;
  size: number;
}

export default function FarmTileComponent({ tile, size }: FarmTileProps) {
  const item = getItemById(tile.itemId);

  if (!item) {
    return (
      <div
        className="flex items-center justify-center select-none"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        ❓
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center select-none"
      style={{ width: size, height: size }}
      title={item.name}
    >
      <AnimalSprite
        sheet={item.sprite.sheet}
        pos={item.sprite.pos}
        size={Math.round(size * 0.85)}
      />
    </div>
  );
}
