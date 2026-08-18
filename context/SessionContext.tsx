"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { calculateReward } from "@/lib/coins";
import { saveSession, saveProfile, getProfile, FocusSession } from "@/lib/storage";
import { useFarm } from "./FarmContext";

export type SessionStatus = "idle" | "running" | "completed" | "abandoned";

export interface SessionSummary {
  focusedSeconds: number;
  distractedSeconds: number;
  coinsEarned: number;
  tierMultiplier: number;
}

interface SessionContextValue {
  status: SessionStatus;
  elapsedSeconds: number;
  /** Build Mandate Phase 3: accrued from ∫ focusScore dt, not a per-second
   * binary sample — can be fractional. Round/floor at display time (see
   * components/SessionTimer.tsx). */
  focusedSeconds: number;
  distractedSeconds: number;
  /** UI-display-only binary snapshot — the plan's own words: "binary state
   * kept only for UI display." Reward accrual below never reads this. */
  isFocused: boolean;
  faceDetected: boolean;
  lastSummary: SessionSummary | null;
  startSession: (targetMinutes?: number) => void;
  endSession: () => void;
  abandonSession: () => void;
  /** `focusScore` (0..1, continuous) drives reward accrual; `focused`/
   * `faceDetected` are stored only for UI display. */
  setAttentionState: (focused: boolean, faceDetected: boolean, focusScore: number) => void;
  dismissSummary: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { addEarnedCoins, refreshFromStorage } = useFarm();
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [focusedSeconds, setFocusedSeconds] = useState(0);
  const [distractedSeconds, setDistractedSeconds] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [lastSummary, setLastSummary] = useState<SessionSummary | null>(null);
  const sessionRef = useRef<FocusSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Build Mandate Phase 3: the continuous signal the 1s timer below
  // integrates, updated imperatively (not React state — see
  // setAttentionState) every classifier frame, not just on binary
  // transitions. Starts at 0, matching the old isFocused-false default —
  // preserves "Start without Camera" sessions earning nothing, same as
  // before (that path never calls setAttentionState at all).
  const focusScoreRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startSession = useCallback(
    (targetMinutes = 25) => {
      clearTimer();
      const session: FocusSession = {
        id: uuidv4(),
        startTime: Date.now(),
        endTime: null,
        targetMinutes,
        actualFocusedSeconds: 0,
        distractedSeconds: 0,
        coinsEarned: 0,
        completed: false,
      };
      sessionRef.current = session;
      focusScoreRef.current = 0;
      setStatus("running");
      setElapsedSeconds(0);
      setFocusedSeconds(0);
      setDistractedSeconds(0);
      setLastSummary(null);
    },
    [clearTimer]
  );

  // Build Mandate Phase 3: accrues ∫ focusScore dt instead of sampling the
  // binary isFocused snapshot each tick. Still a 1s cadence (unchanged
  // from before this phase — a deliberate scope cut, not an oversight:
  // sub-second integration would be a bigger, separate change to this
  // timer's architecture that nothing in the plan's acceptance criteria
  // actually requires; switching WHAT gets sampled each tick from a binary
  // flag to the continuous score is what "smooths" accrual here, not a
  // higher sample rate — see docs/attention-baseline.md's Phase 3 section).
  //
  // No longer depends on `isFocused` (only `status`) — incidental fix
  // found while doing this: the old effect re-created this interval on
  // EVERY focused/distracted flip (isFocused was a dependency), which
  // meant frequent flickering could disrupt the timer's actual 1000ms
  // cadence. Reading focusScoreRef imperatively instead removes that
  // dependency entirely.
  useEffect(() => {
    if (status !== "running") return;
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
      const score = focusScoreRef.current;
      setFocusedSeconds((s) => {
        const next = s + score;
        if (sessionRef.current) sessionRef.current.actualFocusedSeconds = next;
        return next;
      });
      setDistractedSeconds((s) => {
        const next = s + (1 - score);
        if (sessionRef.current) sessionRef.current.distractedSeconds = next;
        return next;
      });
    }, 1000);
    return () => clearTimer();
  }, [status, clearTimer]);

  const endSession = useCallback(() => {
    if (status !== "running" || !sessionRef.current) return;
    clearTimer();
    const session = sessionRef.current;
    const { coins, tierMultiplier } = calculateReward(
      session.actualFocusedSeconds
    );
    session.endTime = Date.now();
    session.coinsEarned = coins;
    session.completed = true;
    saveSession(session);

    // Update profile
    const profile = getProfile();
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const newStreak =
      profile.lastSessionDate === yesterday
        ? profile.currentStreak + 1
        : profile.lastSessionDate === today
        ? profile.currentStreak
        : 1;
    saveProfile({
      ...profile,
      totalFocusMinutes:
        profile.totalFocusMinutes +
        Math.floor(session.actualFocusedSeconds / 60),
      totalSessions: profile.totalSessions + 1,
      currentStreak: newStreak,
      lastSessionDate: today,
    });
    // Sync FarmContext profile state so the stats strip updates immediately
    refreshFromStorage();

    if (coins > 0) {
      addEarnedCoins(coins, `focus_session_${session.id}`);
    }

    setLastSummary({
      focusedSeconds: session.actualFocusedSeconds,
      distractedSeconds: session.distractedSeconds,
      coinsEarned: coins,
      tierMultiplier,
    });
    setStatus("completed");
  }, [status, clearTimer, addEarnedCoins, refreshFromStorage]);

  const abandonSession = useCallback(() => {
    if (!sessionRef.current) return;
    clearTimer();
    const session = { ...sessionRef.current, endTime: Date.now(), completed: false };
    saveSession(session);
    sessionRef.current = null;
    focusScoreRef.current = 0;
    setStatus("abandoned");
    setElapsedSeconds(0);
    setFocusedSeconds(0);
    setDistractedSeconds(0);
  }, [clearTimer]);

  const setAttentionState = useCallback(
    (focused: boolean, face: boolean, focusScore: number) => {
      setIsFocused(focused);
      setFaceDetected(face);
      focusScoreRef.current = focusScore;
    },
    []
  );

  const dismissSummary = useCallback(() => {
    setLastSummary(null);
    setStatus("idle");
    setElapsedSeconds(0);
    setFocusedSeconds(0);
    setDistractedSeconds(0);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        status,
        elapsedSeconds,
        focusedSeconds,
        distractedSeconds,
        isFocused,
        faceDetected,
        lastSummary,
        startSession,
        endSession,
        abandonSession,
        setAttentionState,
        dismissSummary,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
