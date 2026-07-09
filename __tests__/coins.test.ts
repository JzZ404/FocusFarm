import { calculateReward, earnCoins, spendCoins, getBalance } from "@/lib/coins";
import { getLedger } from "@/lib/storage";

// ─── calculateReward ────────────────────────────────────────────────────────

describe("calculateReward – tier multipliers", () => {
  it("returns 0 coins for 0 focused seconds (warm-up, no full minute)", () => {
    const { coins, tierMultiplier } = calculateReward(0);
    expect(tierMultiplier).toBe(0.5);
    expect(coins).toBe(0);
  });

  it("applies 0.5× multiplier for < 10 focused minutes (e.g. 9m)", () => {
    const { coins, tierMultiplier } = calculateReward(9 * 60); // 9 min
    expect(tierMultiplier).toBe(0.5);
    expect(coins).toBe(Math.floor(9 * 20 * 0.5)); // 90
  });

  it("applies 1× multiplier for exactly 10 focused minutes", () => {
    const { coins, tierMultiplier } = calculateReward(10 * 60);
    expect(tierMultiplier).toBe(1.0);
    expect(coins).toBe(10 * 20 * 1); // 200
  });

  it("applies 1.5× multiplier for exactly 20 focused minutes", () => {
    const { coins, tierMultiplier } = calculateReward(20 * 60);
    expect(tierMultiplier).toBe(1.5);
    expect(coins).toBe(Math.floor(20 * 20 * 1.5)); // 600
  });

  it("applies 2× multiplier for exactly 30 focused minutes", () => {
    const { coins, tierMultiplier } = calculateReward(30 * 60);
    expect(tierMultiplier).toBe(2.0);
    expect(coins).toBe(30 * 20 * 2); // 1200
  });

  it("applies 2× multiplier for > 30 focused minutes (e.g. 45m)", () => {
    const { coins, tierMultiplier } = calculateReward(45 * 60);
    expect(tierMultiplier).toBe(2.0);
    expect(coins).toBe(45 * 20 * 2); // 1800
  });

  it("uses floor of partial minutes for coin calculation", () => {
    // 10m 30s = 10.5 min → floor(10) minutes counted
    const { coins } = calculateReward(10 * 60 + 30);
    expect(coins).toBe(10 * 20 * 1.0); // 200, not 210
  });
});

// ─── earnCoins / spendCoins ─────────────────────────────────────────────────

describe("earnCoins", () => {
  it("increases balance and records a transaction", () => {
    const ledger = earnCoins(50, "test_earn");
    expect(ledger.balance).toBe(50);
    expect(ledger.transactions).toHaveLength(1);
    expect(ledger.transactions[0].type).toBe("earned");
    expect(ledger.transactions[0].amount).toBe(50);
    expect(ledger.transactions[0].reason).toBe("test_earn");
  });

  it("accumulates multiple earnings", () => {
    earnCoins(30, "first");
    const ledger = earnCoins(70, "second");
    expect(ledger.balance).toBe(100);
    expect(ledger.transactions).toHaveLength(2);
  });

  it("persists to localStorage so getBalance reflects the change", () => {
    earnCoins(120, "persist_test");
    expect(getBalance()).toBe(120);
  });
});

describe("spendCoins", () => {
  it("decreases balance and records a spent transaction", () => {
    earnCoins(100, "setup");
    const ledger = spendCoins(40, "purchase_fox");
    expect(ledger).not.toBeNull();
    expect(ledger!.balance).toBe(60);
    expect(ledger!.transactions.at(-1)?.type).toBe("spent");
    expect(ledger!.transactions.at(-1)?.amount).toBe(40);
  });

  it("returns null when balance is insufficient", () => {
    earnCoins(10, "small");
    const result = spendCoins(50, "too_expensive");
    expect(result).toBeNull();
  });

  it("does not modify the ledger when spend fails", () => {
    earnCoins(10, "small");
    spendCoins(50, "too_expensive");
    expect(getLedger().balance).toBe(10);
  });

  it("allows spending the exact balance (boundary check)", () => {
    earnCoins(50, "exact");
    const ledger = spendCoins(50, "exact_spend");
    expect(ledger).not.toBeNull();
    expect(ledger!.balance).toBe(0);
  });
});
