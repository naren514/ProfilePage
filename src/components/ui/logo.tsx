"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "light";
}

const sizes = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
};

export function Logo({ className, size = "md", variant = "default" }: LogoProps) {
  return (
    <div className={cn(sizes[size], className)}>
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <defs>
          <linearGradient id="logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={variant === "light" ? "#f8fafc" : "#1a1a2e"} />
            <stop offset="100%" stopColor={variant === "light" ? "#e2e8f0" : "#16213e"} />
          </linearGradient>
          <linearGradient id="logo-accent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#logo-bg)" />
        {/* Profile silhouette */}
        <circle cx="16" cy="11" r="5" fill="url(#logo-accent)" />
        <path d="M8 26c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="url(#logo-accent)" />
        {/* Subtle ring */}
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="none"
          stroke="url(#logo-accent)"
          strokeWidth="0.5"
          opacity="0.3"
        />
      </svg>
    </div>
  );
}
