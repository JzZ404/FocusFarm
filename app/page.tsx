"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFarm } from "@/context/FarmContext";
import { useSession } from "@/context/SessionContext";
import CoinDisplay from "@/components/CoinDisplay";
import FarmCanvas from "@/components/FarmCanvas";
import PixelButton from "@/components/PixelButton";

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function FarmPage() {
  const { ledger, farm, profile } = useFarm();
  const { status, elapsedSeconds } = useSession();
  const router = useRouter();

  const sessionRunning = status === "running";

  return (
    <div
      className="flex flex-col"
      style={{ height: "100dvh", background: "#a8d8c6", overflow: "hidden" }}
    >
      {/* ── Header: other stats left · Sessions centre · coins+Shop right ── */}
      <header
        className="grid shrink-0 px-5 py-3"
        style={{
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          background: "rgba(10,21,10,0.88)",
          borderBottom: "3px solid #2d4a2d",
        }}
      >
        {/* Focus / Streak / Animals — left, inline label+value */}
        <div className="flex items-center gap-5">
          {[
            { label: "Focus",   value: `${profile.totalFocusMinutes}m` },
            { label: "Streak",  value: `${profile.currentStreak}🔥` },
            { label: "Animals", value: farm.tiles.length },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="font-pixel text-pixel-sm text-gray-400">{label}</span>
              <span className="font-pixel text-pixel-md text-green-300">{value}</span>
            </div>
          ))}
        </div>

        {/* Sessions — centre, inline matching left stats */}
        <div className="flex items-center gap-2">
          <span className="font-pixel text-pixel-sm text-gray-400">Sessions</span>
          <span className="font-pixel text-pixel-lg text-green-300" style={{ lineHeight: 1 }}>
            {profile.totalSessions}
          </span>
        </div>

        {/* Coins + Shop — right */}
        <div className="flex items-center justify-end gap-3">
          <CoinDisplay balance={ledger.balance} size="sm" />
          <Link href="/shop">
            <PixelButton size="sm">🛒 Shop</PixelButton>
          </Link>
        </div>
      </header>

      {/* ── Farm canvas — vertically centred ─────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center relative"
        style={{ minHeight: 0 }}
      >
        <FarmCanvas />

        {/* Floating button — centred near the bottom of the farm area */}
        <div
          className="absolute bottom-8 left-1/2"
          style={{ transform: "translateX(-50%)" }}
        >
          {sessionRunning ? (
            /* Session in progress — show live timer + tap to return */
            <button
              onClick={() => router.push("/session")}
              className="font-pixel text-pixel-sm flex items-center gap-3 px-5 py-3 rounded-xl"
              style={{
                background: "rgba(10,21,10,0.55)",
                border: "2px solid rgba(74,222,128,0.6)",
                backdropFilter: "blur(6px)",
                color: "#4ade80",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#4ade80",
                  display: "inline-block",
                  animation: "pulse 1.2s infinite",
                }}
              />
              ⏱ {fmt(elapsedSeconds)} · tap to return
            </button>
          ) : (
            /* No session — solid green button */
            <button
              onClick={() => router.push("/session")}
              className="font-pixel text-pixel-md px-6 py-3 rounded-xl"
              style={{
                background: "#4ade80",
                border: "none",
                boxShadow: "0 4px 0 #16a34a, 0 6px 20px rgba(0,0,0,0.35)",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              🎯 START FOCUS SESSION
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
