import type { Metadata, Viewport } from "next";
import { SaveApp } from "./save-app";

export const metadata: Metadata = {
  title: "Save to Reading",
  manifest: "/save/manifest.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Save", statusBarStyle: "default" },
  icons: { apple: [{ url: "/save/icon?size=180", sizes: "180x180" }] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default function SavePage({ searchParams }: { searchParams: { url?: string; text?: string; title?: string } }) {
  return <SaveApp shared={{ url: searchParams.url ?? "", text: searchParams.text ?? "", title: searchParams.title ?? "" }} />;
}
