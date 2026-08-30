import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://nexus-website-inky.vercel.app"),
  title: "NEXUS — Innovate. Lead. Build.",
  description:
    "NEXUS is the student tech collective of VIT Chennai. A redesigned terminal-grade home: scroll-driven flight, live ASCII engines, events, news and more.",
  keywords: [
    "NEXUS",
    "VIT Chennai",
    "tech club",
    "hackathon",
    "AI",
    "robotics",
    "cybersecurity",
  ],
  authors: [{ name: "NEXUS Club, VIT Chennai" }],
  icons: {
    icon: "/logo.svg",
  },
  alternates: {
    types: {
      "application/rss+xml": "/api/feed.xml",
      "text/calendar": "/api/calendar.ics",
    },
  },
  openGraph: {
    title: "NEXUS — Innovate. Lead. Build.",
    description:
      "The student tech collective of VIT Chennai. Scroll to fly through our world.",
    siteName: "NEXUS",
    images: [
      { url: "/media/og.png", width: 1344, height: 768, alt: "NEXUS — the campus grid" },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NEXUS — Innovate. Lead. Build.",
    description:
      "The student tech collective of VIT Chennai. Scroll to fly through our world.",
    images: ["/media/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
