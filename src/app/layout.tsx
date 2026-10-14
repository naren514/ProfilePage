import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import { getSiteSettings } from "@/lib/settings";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Default metadata - customize these values for your portfolio
export const metadata: Metadata = {
  title: {
    default: "Naren Challa",
    template: "%s | Naren Challa",
  },
  description:
    "Solution Architect with 18+ years in enterprise applications — Oracle OTM/GTM, Oracle Fusion, AWS, and supply chain platforms.",
  keywords: [
    "Naren Challa",
    "Solution Architect",
    "Oracle OTM",
    "Oracle GTM",
    "Supply Chain",
    "Enterprise Applications",
    "AWS",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://narenc.com",
    title: "Naren Challa",
    description:
      "Solution Architect with 18+ years in enterprise applications — Oracle OTM/GTM, Oracle Fusion, AWS, and supply chain platforms.",
    siteName: "Naren Challa",
  },
  twitter: {
    card: "summary_large_image",
    title: "Naren Challa",
    description:
      "Solution Architect with 18+ years in enterprise applications — Oracle OTM/GTM, Oracle Fusion, AWS, and supply chain platforms.",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read on the server: /api/admin/settings is behind the admin session
  // middleware, so public visitors cannot fetch it from the browser.
  const settings = await getSiteSettings();
  const siteName = settings.hero?.name?.trim() || "Naren Challa";

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
        <div className="relative min-h-screen flex flex-col">
          <Header siteName={siteName} showPhotos={(settings.photos?.length ?? 0) > 0} />
          <main className="flex-1">{children}</main>
          <Footer siteName={siteName} contact={settings.contact} />
        </div>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
