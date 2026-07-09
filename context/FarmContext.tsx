"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { SHOP_ITEMS } from "@/data/shopItems";
import { spendCoins, earnCoins } from "@/lib/coins";
import { isTileOccupied, placeTile } from "@/lib/farmUtils";
import {
  CoinLedger,
  FarmGrid,
  FarmTile,
  UserProfile,
  getFarm,
  getLedger,
  getProfile,
  saveFarm,
  saveProfile,
} from "@/lib/storage";

interface FarmContextValue {
  profile: UserProfile;
  ledger: CoinLedger;
  farm: FarmGrid;
  pendingItemId: string | null;
  purchaseItem: (itemId: string) => boolean;
  placeItem: (gridX: number, gridY: number) => boolean;
  cancelPlacement: () => void;
  addEarnedCoins: (amount: number, reason: string) => void;
  refreshFromStorage: () => void;
}

const FarmContext = createContext<FarmContextValue | null>(null);

const PENDING_ITEM_KEY = "focusfarm:pendingItem";

export function FarmProvider({ children }: { children: React.ReactNode }) {
  // Use static defaults to avoid SSR/client hydration mismatch.
  // The useEffect below loads real values from localStorage after mount.
  const [profile, setProfile] = useState<UserProfile>({
    userId: "",
    createdAt: 0,
    totalFocusMinutes: 0,
    totalSessions: 0,
    currentStreak: 0,
    lastSessionDate: "",
  });
  const [ledger, setLedger] = useState<CoinLedger>({ balance: 0, transactions: [] });
  const [farm, setFarm] = useState<FarmGrid>({ gridWidth: 12, gridHeight: 8, tiles: [] });
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const refreshFromStorage = useCallback(() => {
    setProfile(getProfile());
    setLedger(getLedger());
    setFarm(getFarm());
  }, []);

  // Hydrate all state from localStorage on client mount.
  // Also clear any stale pendingItem key left over from the old click-to-place
  // flow (animals are now auto-placed on purchase).
  useEffect(() => {
    refreshFromStorage();
    if (typeof window !== "undefined") {
      localStorage.removeItem(PENDING_ITEM_KEY);
    }
  }, [refreshFromStorage]);

  const addEarnedCoins = useCallback((amount: number, reason: string) => {
    const updated = earnCoins(amount, reason);
    setLedger(updated);
  }, []);

  const purchaseItem = useCallback(
    (itemId: string): boolean => {
      const item = SHOP_ITEMS.find((i) => i.id === itemId);
      if (!item) return false;
      const updated = spendCoins(item.cost, `purchase_${itemId}`);
      if (!updated) return false;
      setLedger(updated);

      // Auto-place at the first free grid cell — no click-to-place needed
      // since the farm is now a free-roaming canvas (grid position is ignored visually)
      setFarm((currentFarm) => {
        for (let y = 0; y < currentFarm.gridHeight; y++) {
          for (let x = 0; x < currentFarm.gridWidth; x++) {
            if (!isTileOccupied(currentFarm, x, y)) {
              const tile: FarmTile = {
                id: uuidv4(),
                itemId,
                gridX: x,
                gridY: y,
                placedAt: Date.now(),
              };
              const placed = placeTile(currentFarm, tile);
              if (placed) {
                saveFarm(placed);
                return placed;
              }
            }
          }
        }
        return currentFarm; // grid full — don't add
      });

      return true;
    },
    [] // no deps — uses setFarm callback form to get latest farm state
  );

  const placeItem = useCallback(
    (gridX: number, gridY: number): boolean => {
      if (!pendingItemId) return false;
      const tile: FarmTile = {
        id: uuidv4(),
        itemId: pendingItemId,
        gridX,
        gridY,
        placedAt: Date.now(),
      };
      const updated = placeTile(farm, tile);
      if (!updated) return false;
      saveFarm(updated);
      setFarm(updated);
      setPendingItemId(null);
      return true;
    },
    [pendingItemId, farm]
  );

  const cancelPlacement = useCallback(() => {
    if (!pendingItemId) return;
    // Refund the coin cost
    const item = SHOP_ITEMS.find((i) => i.id === pendingItemId);
    if (item) {
      const refunded = earnCoins(item.cost, `refund_${pendingItemId}`);
      setLedger(refunded);
    }
    setPendingItemId(null);
  }, [pendingItemId]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    if (profile.lastSessionDate !== today) {
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .split("T")[0];
      const streak =
        profile.lastSessionDate === yesterday ? profile.currentStreak : 0;
      if (streak !== profile.currentStreak) {
        const updated = { ...profile, currentStreak: streak };
        saveProfile(updated);
        setProfile(updated);
      }
    }
  }, [profile]);

  return (
    <FarmContext.Provider
      value={{
        profile,
        ledger,
        farm,
        pendingItemId,
        purchaseItem,
        placeItem,
        cancelPlacement,
        addEarnedCoins,
        refreshFromStorage,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm(): FarmContextValue {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used inside FarmProvider");
  return ctx;
}
