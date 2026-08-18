"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFarm } from "@/context/FarmContext";
import { useSession } from "@/context/SessionContext";
import CoinDisplay from "@/components/CoinDisplay";
import FarmCanvas from "@/components/FarmCanvas";
import PixelButton from "@/components/PixelButton";
import ClearAnimalsButton from "@/components/ClearAnimalsButton";

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
        {/* Home + Focus / Streak / Animals — left, inline label+value */}
        <div className="flex items-center gap-5">
          <Link href="/">
            <PixelButton variant="outline" size="sm">Home</PixelButton>
          </Link>
          {[
            { label: "Focus",   value: `${profile.totalFocusMinutes}m` },
            { label: "Streak",  value: profile.currentStreak },
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
            <PixelButton size="sm">Shop</PixelButton>
          </Link>
        </div>
      </header>

      {/* ── Farm canvas — vertically centred ─────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center relative"
        style={{ minHeight: 0 }}
      >
        <FarmCanvas />

        {/* Floating button — centred near the bottom of the farm area.
            Was a bespoke rounded-xl pill in its own one-off color scheme
            (a 4th, unrelated button language) with white text on #4ade80
            — 1.74:1, badly failing the 4.5:1 text standard on the app's
            main call-to-action. Now a real PixelButton (onScene: the farm
            canvas is a varied illustrated scene like the starter menu, not
            a flat dark page, so it needs the same scene-tuned border — see
            .pixel-btn-on-scene in globals.css), which also folds this into
            the same primary/secondary language used everywhere else. */}
        <div
          className="absolute bottom-8 left-1/2"
          style={{ transform: "translateX(-50%)" }}
        >
          {sessionRunning ? (
            /* Session in progress — show live timer + tap to return */
            <PixelButton
              variant="outline"
              onScene
              onClick={() => router.push("/session")}
            >
              <span
                style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#4ade80",
                  display: "inline-block",
                  animation: "pulse 1.2s infinite",
                }}
              />
              {fmt(elapsedSeconds)} · tap to return
            </PixelButton>
          ) : (
            /* No session — primary CTA */
            <PixelButton size="lg" onScene onClick={() => router.push("/session")}>
              Start Focus Session
            </PixelButton>
          )}
        </div>
      </div>

      <ClearAnimalsButton />
    </div>
  );
}
