import { v4 as uuidv4 } from "uuid";

export interface UserProfile {
  userId: string;
  createdAt: number;
  totalFocusMinutes: number;
  totalSessions: number;
  currentStreak: number;
  lastSessionDate: string;
}

export interface CoinTransaction {
  id: string;
  type: "earned" | "spent";
  amount: number;
  reason: string;
  timestamp: number;
}

export interface CoinLedger {
  balance: number;
  transactions: CoinTransaction[];
}

export interface FocusSession {
  id: string;
  startTime: number;
  endTime: number | null;
  targetMinutes: number;
  actualFocusedSeconds: number;
  distractedSeconds: number;
  coinsEarned: number;
  completed: boolean;
}

export interface FarmTile {
  id: string;
  itemId: string;
  gridX: number;
  gridY: number;
  placedAt: number;
}

export interface FarmGrid {
  gridWidth: number;
  gridHeight: number;
  tiles: FarmTile[];
}

const KEYS = {
  profile: "focusfarm:profile",
  coins: "focusfarm:coins",
  sessions: "focusfarm:sessions",
  farm: "focusfarm:farm",
} as const;

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("localStorage write failed:", e);
    }
  }
}

export function getProfile(): UserProfile {
  const fallback: UserProfile = {
    userId: uuidv4(),
    createdAt: Date.now(),
    totalFocusMinutes: 0,
    totalSessions: 0,
    currentStreak: 0,
    lastSessionDate: "",
  };
  const stored = safeGet<UserProfile | null>(KEYS.profile, null);
  if (!stored) {
    safeSet(KEYS.profile, fallback);
    return fallback;
  }
  return stored;
}

export function saveProfile(profile: UserProfile): void {
  safeSet(KEYS.profile, profile);
}

export function getLedger(): CoinLedger {
  // DEMO MODE: starting balance bumped from 0 → 50 so demo users can buy
  // a cheap animal immediately. Revert to 0 after the demo.
  return safeGet<CoinLedger>(KEYS.coins, { balance: 50, transactions: [] });
}

export function saveLedger(ledger: CoinLedger): void {
  safeSet(KEYS.coins, ledger);
}

export function getSessions(): FocusSession[] {
  return safeGet<FocusSession[]>(KEYS.sessions, []);
}

export function saveSession(session: FocusSession): void {
  const sessions = getSessions();
  const existing = sessions.findIndex((s) => s.id === session.id);
  if (existing >= 0) {
    sessions[existing] = session;
  } else {
    sessions.push(session);
  }
  // Cap at last 50 sessions
  const capped = sessions.slice(-50);
  safeSet(KEYS.sessions, capped);
}

export function getFarm(): FarmGrid {
  return safeGet<FarmGrid>(KEYS.farm, {
    gridWidth: 12,
    gridHeight: 8,
    tiles: [],
  });
}

export function saveFarm(farm: FarmGrid): void {
  safeSet(KEYS.farm, farm);
}

// Dev/testing helper — wipes placed animals only. Coins, profile, streak,
// and session history are left untouched.
export function clearFarmTiles(): FarmGrid {
  const cleared: FarmGrid = { ...getFarm(), tiles: [] };
  saveFarm(cleared);
  return cleared;
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}
