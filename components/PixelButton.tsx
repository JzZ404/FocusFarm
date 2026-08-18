"use client";

import React from "react";

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "danger" | "tertiary";
  size?: "sm" | "md" | "lg";
  // Set on the 3 starter-menu buttons (Start/Shop/How to Play), which sit
  // directly on StartMenuBackground's illustrated scene instead of a flat
  // dark page. See .pixel-btn-on-scene in globals.css for why that needs a
  // different border than every other button in the app. No-op for
  // variant="tertiary" (it has no chunky border to swap).
  onScene?: boolean;
  children: React.ReactNode;
}

export default function PixelButton({
  variant = "primary",
  size = "md",
  onScene = false,
  className = "",
  children,
  ...props
}: PixelButtonProps) {
  const variantClass =
    variant === "outline"
      ? "pixel-btn-outline"
      : variant === "danger"
      ? "pixel-btn-danger"
      : variant === "tertiary"
      ? "pixel-btn-tertiary"
      : "";

  // Tertiary sets its own compact font-size/padding (see globals.css) —
  // composing it with pixel-btn-sm/lg would fight that on cascade order,
  // so size is ignored for it.
  const sizeClass =
    variant === "tertiary" ? "" : size === "sm" ? "pixel-btn-sm" : size === "lg" ? "pixel-btn-lg" : "";

  const sceneClass = onScene && variant !== "tertiary" ? "pixel-btn-on-scene" : "";

  return (
    <button
      className={`pixel-btn ${variantClass} ${sizeClass} ${sceneClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
