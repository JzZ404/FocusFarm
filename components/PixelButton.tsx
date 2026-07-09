"use client";

import React from "react";

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export default function PixelButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: PixelButtonProps) {
  const variantClass =
    variant === "outline"
      ? "pixel-btn-outline"
      : variant === "danger"
      ? "pixel-btn-danger"
      : "";

  const sizeClass = size === "sm" ? "pixel-btn-sm" : size === "lg" ? "pixel-btn-lg" : "";

  return (
    <button
      className={`pixel-btn ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
