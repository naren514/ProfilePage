"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  initials?: string;
}

const sizes = {
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-12 w-12 text-base",
};

export function Logo({ className, size = "md", initials: propInitials }: LogoProps) {
  const [initials, setInitials] = useState(propInitials || "P");

  // Fetch initials from settings if not provided
  useEffect(() => {
    if (propInitials) return;

    async function fetchSettings() {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.hero?.name) {
            // Generate initials from name (e.g., "John Doe" -> "JD")
            const names = data.hero.name.split(" ").filter(Boolean);
            const generatedInitials = names
              .map((n: string) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);
            setInitials(generatedInitials || "P");
          }
        }
      } catch {
        // Use default on error
      }
    }
    fetchSettings();
  }, [propInitials]);

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-foreground text-background font-bold",
        sizes[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
