import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import FeedbackWidget from "@/components/FeedbackWidget";
import "./globals.css";

const inter = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-inter",
});

// Editorial display serif — the "an analyst wrote this" voice.
const instrumentSerif = localFont({
  src: [
    { path: "./fonts/InstrumentSerif-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/InstrumentSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sushi-eda.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sushi — Understand any data file in 60 seconds",
    template: "%s | Sushi",
  },
  description:
    "Drop in a CSV, Excel, or JSON export and get a plain-English report you can trust and share: " +
    "a data quality score, key findings written by AI, interactive charts, and answers to your questions — no code, no analyst required.",
  keywords: [
    "data analysis for product managers", "CSV analysis", "understand spreadsheet data",
    "data quality score", "AI data summary", "survey results analysis",
    "A/B test analysis", "no-code data analysis", "shareable data report",
  ],
  authors: [{ name: "Sushi" }],
  creator: "Sushi",
  openGraph: {
    title: "Sushi — Understand any data file in 60 seconds",
    description:
      "Drop in a data file, get a plain-English report you can trust and share. " +
      "Quality score, AI-written key findings, charts, and answers — no code required.",
    type: "website",
    url: SITE_URL,
    siteName: "Sushi",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Sushi — instant data reports" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sushi — Understand any data file in 60 seconds",
    description: "Drop in a data file, get a plain-English report you can trust and share. No code required.",
    images: ["/og-image.png"],
    creator: "@sushi_eda",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
};

// Without a Clerk publishable key the app runs in open demo mode and
// ClerkProvider must not mount (it throws / blocks rendering without keys).
const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tree = (
    <html lang="en">
      <body className={`${inter.variable} ${instrumentSerif.variable} font-sans antialiased`}>
        {children}
        <FeedbackWidget />
      </body>
    </html>
  );
  return CLERK_ENABLED ? <ClerkProvider>{tree}</ClerkProvider> : tree;
}
