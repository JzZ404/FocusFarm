"use client";

import { useMemo, useState } from "react";
import { SHOP_ITEMS, ShopItem } from "@/data/shopItems";
import { useFarm } from "@/context/FarmContext";
import ShopItemCard from "./ShopItemCard";
import DeliveryToast from "./DeliveryToast";
import PixelLock from "./PixelLock";

type SortKey = "default" | "price-asc" | "price-desc" | "affordable";

// Column classes shared by both the main grid and the locked-section grid
// below it, so animals line up in the same columns regardless of which
// section they're in.
const GRID_COLS = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3";

export default function ShopCatalog() {
  const { ledger, profile } = useFarm();
  const [sort, setSort] = useState<SortKey>("default");
  // key increments on every purchase so DeliveryToast remounts (and its
  // auto-dismiss timer restarts) even when re-buying the same item back to
  // back, instead of the second purchase silently extending the first toast.
  const [toast, setToast] = useState<{ item: ShopItem; key: number } | null>(null);

  // Locked animals (unmet focus-minutes requirement) always group together
  // at the bottom, cheapest first, regardless of the selected sort — the
  // sort controls above only reorder the *unlocked* section. Doing this as
  // two separate arrays (rather than one sorted-with-a-locked-tiebreak
  // list) also lets the grid give the locked section its own row instead
  // of an unlocked/locked mix mid-row.
  const { unlocked, locked } = useMemo(() => {
    const isLocked = (item: ShopItem) =>
      !!item.unlockMinFocusMinutes && profile.totalFocusMinutes < item.unlockMinFocusMinutes;

    const unlockedList = SHOP_ITEMS.filter((item) => !isLocked(item));
    const lockedList = SHOP_ITEMS.filter(isLocked).sort((a, b) => a.cost - b.cost);

    if (sort === "price-asc") unlockedList.sort((a, b) => a.cost - b.cost);
    if (sort === "price-desc") unlockedList.sort((a, b) => b.cost - a.cost);
    if (sort === "affordable")
      unlockedList.sort((a, b) => {
        const aAfford = ledger.balance >= a.cost ? 0 : 1;
        const bAfford = ledger.balance >= b.cost ? 0 : 1;
        return aAfford - bAfford || a.cost - b.cost;
      });

    return { unlocked: unlockedList, locked: lockedList };
  }, [sort, ledger.balance, profile.totalFocusMinutes]);

  return (
    <div className="flex flex-col gap-4">
      {/* Shared SVG filter defs for ShopItemCard's pixelated lock blur —
          rendered once here rather than once per locked card, since the
          filter graph itself is identical for all of them (only which
          card's :hover state is active differs, and that's handled by
          CSS's `.group:hover .pixel-blur-locked` in globals.css, not by
          the filter definition). width/height 0 + absolute positioning:
          contributes nothing to layout, just needs to exist in the DOM.
          Block sizes: resting is what used to be the hover filter (4px
          blocks) — the default state reads less obscured now — and hover
          steps down one more notch to 2px blocks for the peek. */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <filter id="pixelate-locked" x="-20%" y="-20%" width="140%" height="140%">
            <feFlood x="2" y="2" width="1" height="1" />
            <feComposite width="4" height="4" />
            <feTile result="tiled" />
            <feComposite in="SourceGraphic" in2="tiled" operator="in" />
            <feMorphology operator="dilate" radius="2" />
          </filter>
          <filter id="pixelate-locked-hover" x="-20%" y="-20%" width="140%" height="140%">
            <feFlood x="1" y="1" width="1" height="1" />
            <feComposite width="2" height="2" />
            <feTile result="tiled" />
            <feComposite in="SourceGraphic" in2="tiled" operator="in" />
            <feMorphology operator="dilate" radius="1" />
          </filter>
        </defs>
      </svg>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-pixel text-pixel-sm text-gray-400">Sort:</span>
        {(
          [
            { key: "default", label: "Default" },
            { key: "price-asc", label: "Cheapest first" },
            { key: "price-desc", label: "Most expensive" },
            { key: "affordable", label: "Can afford" },
          ] as { key: SortKey; label: string }[]
        ).map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSort(opt.key)}
            aria-pressed={sort === opt.key}
            className={`pixel-chip font-pixel text-pixel-sm px-3 py-2 ${
              sort === opt.key ? "pixel-chip-on" : "pixel-chip-off"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="font-pixel text-pixel-sm text-gray-500 ml-auto">
          {SHOP_ITEMS.length} animals
        </span>
      </div>

      <div className={GRID_COLS}>
        {unlocked.map((item) => (
          <ShopItemCard
            key={item.id}
            item={item}
            onPurchased={(bought) =>
              setToast((prev) => ({ item: bought, key: (prev?.key ?? 0) + 1 }))
            }
          />
        ))}
      </div>

      {locked.length > 0 && (
        <>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 h-px" style={{ background: "#2d4a2d" }} />
            <span className="font-pixel text-pixel-xs text-gray-500 flex items-center gap-2 shrink-0">
              <PixelLock size={11} />
              Locked
            </span>
            <div className="flex-1 h-px" style={{ background: "#2d4a2d" }} />
          </div>

          <div className={GRID_COLS}>
            {locked.map((item) => (
              <ShopItemCard
                key={item.id}
                item={item}
                onPurchased={(bought) =>
                  setToast((prev) => ({ item: bought, key: (prev?.key ?? 0) + 1 }))
                }
              />
            ))}
          </div>
        </>
      )}

      {toast && (
        <DeliveryToast key={toast.key} item={toast.item} onDone={() => setToast(null)} />
      )}
    </div>
  );
}
