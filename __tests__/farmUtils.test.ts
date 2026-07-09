import {
  isValidPosition,
  isTileOccupied,
  placeTile,
  removeTile,
  getTileAt,
} from "@/lib/farmUtils";
import { FarmGrid, FarmTile } from "@/lib/storage";

const BASE_FARM: FarmGrid = { gridWidth: 12, gridHeight: 8, tiles: [] };

const makeTile = (gridX: number, gridY: number, id = "t1"): FarmTile => ({
  id,
  itemId: "fox",
  gridX,
  gridY,
  placedAt: 0,
});

// ─── isValidPosition ────────────────────────────────────────────────────────

describe("isValidPosition", () => {
  it("accepts a position inside an empty grid", () => {
    expect(isValidPosition(BASE_FARM, 0, 0)).toBe(true);
    expect(isValidPosition(BASE_FARM, 11, 7)).toBe(true); // bottom-right corner
    expect(isValidPosition(BASE_FARM, 5, 4)).toBe(true);
  });

  it("rejects negative coordinates", () => {
    expect(isValidPosition(BASE_FARM, -1, 0)).toBe(false);
    expect(isValidPosition(BASE_FARM, 0, -1)).toBe(false);
  });

  it("rejects coordinates at or beyond grid dimensions", () => {
    expect(isValidPosition(BASE_FARM, 12, 0)).toBe(false); // gridWidth = 12
    expect(isValidPosition(BASE_FARM, 0, 8)).toBe(false);  // gridHeight = 8
  });

  it("rejects a position already occupied by a tile", () => {
    const farm = { ...BASE_FARM, tiles: [makeTile(3, 3)] };
    expect(isValidPosition(farm, 3, 3)).toBe(false);
  });
});

// ─── isTileOccupied ─────────────────────────────────────────────────────────

describe("isTileOccupied", () => {
  it("returns false on an empty farm", () => {
    expect(isTileOccupied(BASE_FARM, 0, 0)).toBe(false);
  });

  it("returns true when a tile exists at the given coordinates", () => {
    const farm = { ...BASE_FARM, tiles: [makeTile(4, 2)] };
    expect(isTileOccupied(farm, 4, 2)).toBe(true);
  });

  it("returns false for adjacent (non-occupied) coordinates", () => {
    const farm = { ...BASE_FARM, tiles: [makeTile(4, 2)] };
    expect(isTileOccupied(farm, 5, 2)).toBe(false);
    expect(isTileOccupied(farm, 4, 3)).toBe(false);
  });
});

// ─── placeTile ──────────────────────────────────────────────────────────────

describe("placeTile", () => {
  it("returns an updated farm with the tile appended", () => {
    const tile = makeTile(1, 1);
    const updated = placeTile(BASE_FARM, tile);
    expect(updated).not.toBeNull();
    expect(updated!.tiles).toHaveLength(1);
    expect(updated!.tiles[0]).toEqual(tile);
  });

  it("does not mutate the original farm", () => {
    const tile = makeTile(2, 2);
    placeTile(BASE_FARM, tile);
    expect(BASE_FARM.tiles).toHaveLength(0);
  });

  it("returns null if the target cell is already occupied", () => {
    const farm = { ...BASE_FARM, tiles: [makeTile(3, 3, "existing")] };
    const result = placeTile(farm, makeTile(3, 3, "new"));
    expect(result).toBeNull();
  });

  it("returns null for out-of-bounds coordinates", () => {
    expect(placeTile(BASE_FARM, makeTile(99, 0))).toBeNull();
    expect(placeTile(BASE_FARM, makeTile(0, 99))).toBeNull();
  });

  it("allows placing multiple tiles at different positions", () => {
    let farm = placeTile(BASE_FARM, makeTile(0, 0, "a"))!;
    farm = placeTile(farm, makeTile(1, 0, "b"))!;
    farm = placeTile(farm, makeTile(0, 1, "c"))!;
    expect(farm.tiles).toHaveLength(3);
  });
});

// ─── removeTile ─────────────────────────────────────────────────────────────

describe("removeTile", () => {
  it("removes the tile with the given id", () => {
    const farm = { ...BASE_FARM, tiles: [makeTile(2, 2, "remove-me"), makeTile(3, 3, "keep")] };
    const updated = removeTile(farm, "remove-me");
    expect(updated.tiles).toHaveLength(1);
    expect(updated.tiles[0].id).toBe("keep");
  });

  it("returns the farm unchanged if the id does not exist", () => {
    const farm = { ...BASE_FARM, tiles: [makeTile(1, 1, "existing")] };
    const updated = removeTile(farm, "nonexistent");
    expect(updated.tiles).toHaveLength(1);
  });
});

// ─── getTileAt ──────────────────────────────────────────────────────────────

describe("getTileAt", () => {
  it("returns undefined for an empty farm", () => {
    expect(getTileAt(BASE_FARM, 0, 0)).toBeUndefined();
  });

  it("finds the tile at the correct coordinates", () => {
    const tile = makeTile(5, 3, "find-me");
    const farm = { ...BASE_FARM, tiles: [tile] };
    expect(getTileAt(farm, 5, 3)).toEqual(tile);
  });

  it("returns undefined for adjacent coordinates", () => {
    const farm = { ...BASE_FARM, tiles: [makeTile(5, 3)] };
    expect(getTileAt(farm, 6, 3)).toBeUndefined();
    expect(getTileAt(farm, 5, 4)).toBeUndefined();
  });
});
