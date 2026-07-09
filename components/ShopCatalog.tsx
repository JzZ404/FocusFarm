"use client";

import { useMemo, useState } from "react";
import { SHOP_ITEMS } from "@/data/shopItems";
import { useFarm } from "@/context/FarmContext";
import ShopItemCard from "./ShopItemCard";

type SortKey = "default" | "price-asc" | "price-desc" | "affordable";

export default function ShopCatalog() {
  const { ledger } = useFarm();
  const [sort, setSort] = useState<SortKey>("default");

  const items = useMemo(() => {
    const list = [...SHOP_ITEMS];
    if (sort === "price-asc") list.sort((a, b) => a.cost - b.cost);
    if (sort === "price-desc") list.sort((a, b) => b.cost - a.cost);
    if (sort === "affordable")
      list.sort((a, b) => {
        const aAfford = ledger.balance >= a.cost ? 0 : 1;
        const bAfford = ledger.balance >= b.cost ? 0 : 1;
        return aAfford - bAfford || a.cost - b.cost;
      });
    return list;
  }, [sort, ledger.balance]);

  return (
    <div className="flex flex-col gap-4">
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
            className={`font-pixel text-pixel-sm px-3 py-2 rounded border transition-colors ${
              sort === opt.key
                ? "border-farm-focused bg-farm-focused/20 text-farm-focused"
                : "border-farm-border bg-farm-panel text-gray-400 hover:border-farm-grass"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="font-pixel text-pixel-sm text-gray-500 ml-auto">
          {SHOP_ITEMS.length} animals
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {items.map((item) => (
          <ShopItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
