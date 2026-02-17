import type { Metadata } from "next";
import { Inter } from "next/font/google";
import dynamic from "next/dynamic";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "@/components/ui/sonner";

// Dynamic import with SSR disabled for client-only auth state bootstrap
const AuthProvider = dynamic(
  () => import("@/lib/auth/auth-context").then((mod) => mod.AuthProvider),
  { ssr: false }
);

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Default metadata - customize these values for your portfolio
export const metadata: Metadata = {
  title: {
    default: "Professional Portfolio",
    template: "%s | Portfolio",
  },
  description:
    "AI-powered professional portfolio showcasing experience, projects, and skills.",
  keywords: [
    "Portfolio",
    "Professional",
    "Experience",
    "Work",
    "Skills",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Professional Portfolio",
    description:
      "AI-powered professional portfolio with chat capabilities.",
    siteName: "Portfolio",
  },
  twitter: {
    card: "summary_large_image",
    title: "Professional Portfolio",
    description:
      "AI-powered professional portfolio with chat capabilities.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
        <AuthProvider>
          <div className="relative min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
