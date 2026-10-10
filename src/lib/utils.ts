import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Build a profile link from a setting that may be a full URL, a bare
// "site.com/handle" address, or just the handle.
export function profileUrl(value: string, base: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const host = base.replace(/^https?:\/\//, "").split("/")[0];
  if (trimmed.replace(/^www\./i, "").toLowerCase().startsWith(host)) {
    return `https://${trimmed}`;
  }
  return `${base}${trimmed.replace(/^\/+/, "")}`;
}
