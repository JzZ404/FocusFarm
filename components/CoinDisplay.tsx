"use client";

import { useEffect, useRef, useState } from "react";

interface CoinDisplayProps {
  balance: number;
  size?: "sm" | "md" | "lg";
}

export default function CoinDisplay({ balance, size = "md" }: CoinDisplayProps) {
  const [animating, setAnimating] = useState(false);
  const prevRef = useRef(balance);

  useEffect(() => {
    if (balance !== prevRef.current) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 450);
      prevRef.current = balance;
      return () => clearTimeout(t);
    }
  }, [balance]);

  // Maps to the canonical typography scale (see app/globals.css):
  //   sm → text-pixel-sm (9px)   md → text-pixel-md (11px)   lg → text-pixel-lg (16px)
  const textClass = size === "sm" ? "text-pixel-sm" : size === "lg" ? "text-pixel-lg" : "text-pixel-md";
  const coinSize = size === "sm" ? 14 : size === "lg" ? 22 : 18;

  return (
    <div
      className={`pixel-coin-badge ${textClass} ${animating ? "coin-pop" : ""}`}
    >
      {/* Pixel coin icon */}
      <div
        className="pixel-coin-icon"
        style={{ width: coinSize, height: coinSize }}
      />
      <span>{balance.toLocaleString()}</span>
    </div>
  );
}
