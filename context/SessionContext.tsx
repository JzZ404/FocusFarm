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
  focusedSeconds: number;
  distractedSeconds: number;
  isFocused: boolean;
  faceDetected: boolean;
  lastSummary: SessionSummary | null;
  startSession: (targetMinutes?: number) => void;
  endSession: () => void;
  abandonSession: () => void;
  setAttentionState: (focused: boolean, faceDetected: boolean) => void;
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
      setStatus("running");
      setElapsedSeconds(0);
      setFocusedSeconds(0);
      setDistractedSeconds(0);
      setLastSummary(null);
    },
    [clearTimer]
  );

  useEffect(() => {
    if (status !== "running") return;
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
      if (isFocused) {
        setFocusedSeconds((s) => {
          if (sessionRef.current)
            sessionRef.current.actualFocusedSeconds = s + 1;
          return s + 1;
        });
      } else {
        setDistractedSeconds((s) => {
          if (sessionRef.current) sessionRef.current.distractedSeconds = s + 1;
          return s + 1;
        });
      }
    }, 1000);
    return () => clearTimer();
  }, [status, isFocused, clearTimer]);

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
    setStatus("abandoned");
    setElapsedSeconds(0);
    setFocusedSeconds(0);
    setDistractedSeconds(0);
  }, [clearTimer]);

  const setAttentionState = useCallback(
    (focused: boolean, face: boolean) => {
      setIsFocused(focused);
      setFaceDetected(face);
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
