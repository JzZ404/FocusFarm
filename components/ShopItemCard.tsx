"use client";

import { ShopItem } from "@/data/shopItems";
import { useFarm } from "@/context/FarmContext";
import AtlasAnimalIcon from "./AtlasAnimalIcon";
import PixelButton from "./PixelButton";
import PixelLock from "./PixelLock";

interface ShopItemCardProps {
  item: ShopItem;
  onPurchased?: (item: ShopItem) => void;
}

export default function ShopItemCard({ item, onPurchased }: ShopItemCardProps) {
  const { ledger, profile, purchaseItem, pendingItemId } = useFarm();
  const canAfford = ledger.balance >= item.cost;
  const isPending = pendingItemId === item.id;
  const isLocked =
    !!item.unlockMinFocusMinutes &&
    profile.totalFocusMinutes < item.unlockMinFocusMinutes;

  function handleBuy() {
    if (!canAfford || isLocked) return;
    const ok = purchaseItem(item.id);
    if (ok) onPurchased?.(item);
  }

  return (
    // `group` so the blur/overlay children below can react to hovering
    // anywhere on the card (`group-hover:*`), not just the small overlay
    // itself. `relative` so the lock badge and centered overlay can be
    // absolutely positioned against the card instead of the page.
    <div
      className={`group relative flex flex-col items-center p-4 rounded-lg border transition-colors h-full overflow-hidden min-w-0 ${
        isPending
          ? "border-farm-focused bg-farm-focused/10"
          : "border-farm-border bg-farm-panel hover:border-farm-grass"
      }`}
    >
      {isLocked && (
        <div
          className="absolute top-2 left-2 z-20 flex items-center justify-center rounded"
          style={{ width: 26, height: 26, background: "#0f1f0f", outline: "2px solid #f0c419" }}
        >
          <PixelLock size={15} />
        </div>
      )}

      {/* Card content — pixelated while locked (a "you can't quite make
          this out yet" tease, using the same hard-edged mosaic filter the
          rest of the app's art uses instead of a smooth CSS blur() — see
          .pixel-blur-locked in globals.css), sharpens to a lighter
          pixelation on hover for a peek. */}
      <div
        className={`flex flex-col items-center w-full h-full ${isLocked ? "pixel-blur-locked" : ""}`}
      >
        {/* Sprite preview */}
        <div className="w-24 h-24 flex items-center justify-center mb-2">
          <AtlasAnimalIcon itemId={item.id} size={96} />
        </div>

        <div className="font-pixel text-pixel-md text-white text-center mb-2 w-full break-words">
          {item.name}
        </div>

        {/* Description + price/button grow to fill — keeps them pinned to
            bottom. Description is prose (a real sentence), so it uses the
            sans-serif .text-body face instead of the pixel typography
            scale — see the comment on .text-body in globals.css. */}
        <div className="flex-1 flex flex-col justify-end w-full gap-2 min-w-0">
          <div className="text-body text-gray-400 text-center w-full break-words">
            {item.description}
          </div>

          <div className="flex items-center justify-center gap-2 font-pixel text-pixel-lg text-yellow-300">
            <div className="pixel-coin-icon" style={{ width: 18, height: 18 }} />
            <span>{item.cost}</span>
          </div>

          <PixelButton
            size="sm"
            className="w-full whitespace-nowrap min-h-[36px]"
            onClick={handleBuy}
            disabled={!canAfford || isLocked || !!pendingItemId}
          >
            {isPending ? "…" : isLocked || !canAfford ? "Locked" : "Buy"}
          </PixelButton>
        </div>
      </div>

      {/* Unlock requirement — centered over the blur. pointer-events-none so
          it never blocks the hover detection (or clicks) it sits on top of;
          the group's :hover state is still computed from whatever's
          underneath. Own dark badge (not just floating text) so it stays
          legible regardless of what color the blurred art behind it is. */}
      {isLocked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4 pointer-events-none">
          <div
            className="font-pixel text-pixel-sm text-yellow-300 text-center px-3 py-2 rounded max-w-[85%] transition-opacity duration-200 group-hover:opacity-0"
            style={{ background: "rgba(10,21,10,0.85)", outline: "2px solid #f0c419" }}
          >
            Requires {item.unlockMinFocusMinutes} focus minutes
          </div>
        </div>
      )}
    </div>
  );
}
