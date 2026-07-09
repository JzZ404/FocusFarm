import { FarmGrid, FarmTile } from "./storage";

export function isTileOccupied(
  farm: FarmGrid,
  gridX: number,
  gridY: number
): boolean {
  return farm.tiles.some((t) => t.gridX === gridX && t.gridY === gridY);
}

export function isValidPosition(
  farm: FarmGrid,
  gridX: number,
  gridY: number
): boolean {
  return (
    gridX >= 0 &&
    gridX < farm.gridWidth &&
    gridY >= 0 &&
    gridY < farm.gridHeight &&
    !isTileOccupied(farm, gridX, gridY)
  );
}

export function placeTile(
  farm: FarmGrid,
  tile: FarmTile
): FarmGrid | null {
  if (!isValidPosition(farm, tile.gridX, tile.gridY)) return null;
  return { ...farm, tiles: [...farm.tiles, tile] };
}

export function removeTile(farm: FarmGrid, tileId: string): FarmGrid {
  return { ...farm, tiles: farm.tiles.filter((t) => t.id !== tileId) };
}

export function getTileAt(
  farm: FarmGrid,
  gridX: number,
  gridY: number
): FarmTile | undefined {
  return farm.tiles.find((t) => t.gridX === gridX && t.gridY === gridY);
}
