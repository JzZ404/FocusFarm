import { v4 as uuidv4 } from "uuid";
import { CoinLedger, CoinTransaction, getLedger, saveLedger } from "./storage";

export interface RewardResult {
  coins: number;
  focusedMinutes: number;
  tierMultiplier: number;
}

// DEMO MODE: scaled minutes → seconds so a ~30s demo session shows the
// tier system in action. Revert after the demo:
//   const BASE_COINS_PER_MINUTE = 20;
//   thresholds use focusedMinutes (10/20/30), formula uses focusedMinutes.
const BASE_COINS_PER_SECOND = 5;

export function calculateReward(focusedSeconds: number): RewardResult {
  const focusedMinutes = focusedSeconds / 60;
  let tierMultiplier = 1.0;
  if (focusedSeconds >= 30) tierMultiplier = 2.0;
  else if (focusedSeconds >= 20) tierMultiplier = 1.5;
  else if (focusedSeconds >= 10) tierMultiplier = 1.0;
  else tierMultiplier = 0.5;

  const coins = Math.floor(
    Math.floor(focusedSeconds) * BASE_COINS_PER_SECOND * tierMultiplier
  );
  return { coins, focusedMinutes, tierMultiplier };
}

export function earnCoins(amount: number, reason: string): CoinLedger {
  const ledger = getLedger();
  const tx: CoinTransaction = {
    id: uuidv4(),
    type: "earned",
    amount,
    reason,
    timestamp: Date.now(),
  };
  const updated: CoinLedger = {
    balance: ledger.balance + amount,
    transactions: [...ledger.transactions, tx],
  };
  saveLedger(updated);
  return updated;
}

export function spendCoins(amount: number, reason: string): CoinLedger | null {
  const ledger = getLedger();
  if (ledger.balance < amount) return null;
  const tx: CoinTransaction = {
    id: uuidv4(),
    type: "spent",
    amount,
    reason,
    timestamp: Date.now(),
  };
  const updated: CoinLedger = {
    balance: ledger.balance - amount,
    transactions: [...ledger.transactions, tx],
  };
  saveLedger(updated);
  return updated;
}

export function getBalance(): number {
  return getLedger().balance;
}
