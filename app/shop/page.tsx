"use client";

import Link from "next/link";
import { useFarm } from "@/context/FarmContext";
import CoinDisplay from "@/components/CoinDisplay";
import ShopCatalog from "@/components/ShopCatalog";
import PixelButton from "@/components/PixelButton";

export default function ShopPage() {
  const { ledger, pendingItemId, cancelPlacement } = useFarm();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#1a2e1a" }}>

      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3"
        style={{ background: "#0a150a", borderBottom: "3px solid #2d4a2d" }}
      >
        <div className="flex items-center gap-2">
          <Link href="/">
            <PixelButton variant="outline" size="sm">Home</PixelButton>
          </Link>
          <Link href="/farm">
            <PixelButton variant="outline" size="sm">Farm</PixelButton>
          </Link>
        </div>
        <span className="font-pixel text-pixel-lg text-white">🛒 Shop</span>
        <CoinDisplay balance={ledger.balance} size="sm" />
      </header>

      {/* Placement active banner */}
      {pendingItemId && (
        <div
          className="placement-banner flex items-center justify-between px-5 py-2"
          style={{ background: "rgba(74,222,128,0.12)", borderBottom: "3px solid #4ade80" }}
        >
          <span className="font-pixel text-pixel-sm text-green-300">
            Item purchased! Go back to your farm to place it.
          </span>
          <div className="flex gap-4">
            <Link href="/farm">
              <PixelButton size="sm">Go to Farm</PixelButton>
            </Link>
            <button
              onClick={cancelPlacement}
              className="font-pixel text-pixel-xs text-red-400 hover:text-red-300 underline"
            >
              Cancel (refund)
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 p-5 max-w-5xl mx-auto w-full">
        <div className="mb-5">
          {ledger.balance === 0 && (
            <div className="pixel-panel px-4 py-3 mb-4">
              <p className="font-pixel text-pixel-sm text-yellow-400 text-center">
                🎯 No coins yet!{" "}
                <Link href="/session" className="underline text-yellow-300">
                  Start a focus session
                </Link>{" "}
                to earn some.
              </p>
            </div>
          )}
        </div>

        <ShopCatalog />
      </main>
    </div>
  );
}
