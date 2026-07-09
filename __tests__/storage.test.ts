import {
  getLedger,
  saveLedger,
  getFarm,
  saveFarm,
  getSessions,
  saveSession,
  getProfile,
  saveProfile,
  clearAll,
  FocusSession,
  FarmGrid,
  CoinLedger,
} from "@/lib/storage";

// ─── Ledger ─────────────────────────────────────────────────────────────────

describe("getLedger / saveLedger", () => {
  it("returns default ledger when localStorage is empty", () => {
    const ledger = getLedger();
    expect(ledger.balance).toBe(0);
    expect(ledger.transactions).toEqual([]);
  });

  it("round-trips through localStorage correctly", () => {
    const data: CoinLedger = {
      balance: 250,
      transactions: [
        { id: "t1", type: "earned", amount: 250, reason: "focus", timestamp: 1000 },
      ],
    };
    saveLedger(data);
    expect(getLedger()).toEqual(data);
  });

  it("overwrites previous ledger on save", () => {
    saveLedger({ balance: 100, transactions: [] });
    saveLedger({ balance: 999, transactions: [] });
    expect(getLedger().balance).toBe(999);
  });
});

// ─── Farm ───────────────────────────────────────────────────────────────────

describe("getFarm / saveFarm", () => {
  it("returns default 12×8 farm when localStorage is empty", () => {
    const farm = getFarm();
    expect(farm.gridWidth).toBe(12);
    expect(farm.gridHeight).toBe(8);
    expect(farm.tiles).toEqual([]);
  });

  it("persists and restores a farm with tiles", () => {
    const farm: FarmGrid = {
      gridWidth: 12,
      gridHeight: 8,
      tiles: [
        { id: "tile-1", itemId: "fox", gridX: 2, gridY: 3, placedAt: 5000 },
      ],
    };
    saveFarm(farm);
    expect(getFarm()).toEqual(farm);
  });
});

// ─── Sessions ───────────────────────────────────────────────────────────────

const makeSession = (overrides: Partial<FocusSession> = {}): FocusSession => ({
  id: "sess-" + Math.random().toString(36).slice(2),
  startTime: Date.now(),
  endTime: null,
  targetMinutes: 25,
  actualFocusedSeconds: 600,
  distractedSeconds: 60,
  coinsEarned: 100,
  completed: true,
  ...overrides,
});

describe("getSessions / saveSession", () => {
  it("returns empty array when localStorage is empty", () => {
    expect(getSessions()).toEqual([]);
  });

  it("appends new sessions correctly", () => {
    const s1 = makeSession({ id: "a" });
    const s2 = makeSession({ id: "b" });
    saveSession(s1);
    saveSession(s2);
    const stored = getSessions();
    expect(stored).toHaveLength(2);
    expect(stored.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("updates an existing session when the same id is saved again", () => {
    const session = makeSession({ id: "update-me", coinsEarned: 50 });
    saveSession(session);
    saveSession({ ...session, coinsEarned: 200 });
    const stored = getSessions();
    expect(stored).toHaveLength(1);
    expect(stored[0].coinsEarned).toBe(200);
  });

  it("caps the session list at 50 entries", () => {
    for (let i = 0; i < 55; i++) {
      saveSession(makeSession({ id: `s${i}` }));
    }
    expect(getSessions()).toHaveLength(50);
    // Oldest entries are dropped; latest (s54) should be present
    const ids = getSessions().map((s) => s.id);
    expect(ids).toContain("s54");
    expect(ids).not.toContain("s0");
  });
});

// ─── Profile ────────────────────────────────────────────────────────────────

describe("getProfile / saveProfile", () => {
  it("creates and persists a default profile when none exists", () => {
    const profile = getProfile();
    expect(profile.totalSessions).toBe(0);
    expect(profile.totalFocusMinutes).toBe(0);
    expect(profile.currentStreak).toBe(0);
    // Calling again should return the same userId (not generate a new one)
    expect(getProfile().userId).toBe(profile.userId);
  });

  it("round-trips a saved profile", () => {
    const original = getProfile();
    saveProfile({ ...original, totalSessions: 5, currentStreak: 3 });
    const loaded = getProfile();
    expect(loaded.totalSessions).toBe(5);
    expect(loaded.currentStreak).toBe(3);
  });
});

// ─── clearAll ───────────────────────────────────────────────────────────────

describe("clearAll", () => {
  it("removes all focusfarm keys from localStorage", () => {
    saveLedger({ balance: 100, transactions: [] });
    saveFarm({ gridWidth: 12, gridHeight: 8, tiles: [] });
    saveSession(makeSession());
    clearAll();
    expect(getLedger().balance).toBe(0);
    expect(getFarm().tiles).toEqual([]);
    expect(getSessions()).toEqual([]);
  });
});
