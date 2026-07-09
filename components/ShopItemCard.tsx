"use client";

import { ShopItem } from "@/data/shopItems";
import { useFarm } from "@/context/FarmContext";
import AtlasAnimalIcon from "./AtlasAnimalIcon";
import PixelButton from "./PixelButton";

interface ShopItemCardProps {
  item: ShopItem;
}

export default function ShopItemCard({ item }: ShopItemCardProps) {
  const { ledger, purchaseItem, pendingItemId } = useFarm();
  const canAfford = ledger.balance >= item.cost;
  const isPending = pendingItemId === item.id;

  function handleBuy() {
    if (!canAfford) return;
    purchaseItem(item.id);
  }

  return (
    <div
      className={`flex flex-col items-center p-4 rounded-lg border transition-colors h-full overflow-hidden min-w-0 ${
        isPending
          ? "border-farm-focused bg-farm-focused/10"
          : "border-farm-border bg-farm-panel hover:border-farm-grass"
      }`}
    >
      {/* Sprite preview */}
      <div className="w-24 h-24 flex items-center justify-center mb-2">
        <AtlasAnimalIcon itemId={item.id} size={96} />
      </div>

      <div className="font-pixel text-pixel-md text-white text-center mb-2 w-full break-words">
        {item.name}
      </div>

      {/* Description + unlock grow to fill — keeps price/button pinned to bottom */}
      <div className="flex-1 flex flex-col justify-end w-full gap-2 min-w-0">
        <div className="font-pixel text-pixel-sm text-gray-400 text-center w-full break-words">
          {item.description}
        </div>

        {item.unlockCondition && (
          <div className="font-pixel text-pixel-sm text-yellow-500/70 text-center w-full break-words">
            🔒 {item.unlockCondition}
          </div>
        )}

        <div className="flex items-center justify-center gap-1 font-pixel text-pixel-lg text-yellow-300">
          <span>🪙</span>
          <span>{item.cost}</span>
        </div>

        <PixelButton
          size="sm"
          className="w-full whitespace-nowrap min-h-[36px]"
          onClick={handleBuy}
          disabled={!canAfford || !!pendingItemId}
        >
          {isPending ? "…" : !canAfford ? "Locked" : "Buy"}
        </PixelButton>
      </div>
    </div>
  );
}
