import { siteUrl } from "@/lib/site";
import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
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

// Reading face for headings and long-form text; UI stays in Inter
const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

// Default metadata - customize these values for your portfolio
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
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
  // Feed readers find the RSS feeds from any page
  alternates: {
    types: {
      "application/rss+xml": [
        { url: "/thoughts/rss.xml", title: "Thoughts" },
        { url: "/reading/weekly/rss.xml", title: "Worth your time (weekly reading list)" },
      ],
    },
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
      <body className={`${inter.variable} ${serif.variable} bg-background font-sans antialiased`} suppressHydrationWarning>
        <a href="#content" className="sr-only z-[60] rounded-md bg-foreground px-3 py-2 text-background focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
          Skip to content
        </a>
        <div className="relative min-h-screen flex flex-col">
          <Header siteName={siteName} showPhotos={(settings.photos?.length ?? 0) > 0} />
          <main id="content" className="flex-1">{children}</main>
          <Footer siteName={siteName} contact={settings.contact} />
        </div>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
