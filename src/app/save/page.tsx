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

export default async function SavePage(
  props: { searchParams: Promise<{ url?: string; text?: string; title?: string }> }
) {
  const searchParams = await props.searchParams;
  return <SaveApp shared={{ url: searchParams.url ?? "", text: searchParams.text ?? "", title: searchParams.title ?? "" }} />;
}
