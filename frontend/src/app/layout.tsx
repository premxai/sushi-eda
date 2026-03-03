import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sushi-eda.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sushi — AI-Powered Data Analysis Platform",
    template: "%s | Sushi EDA",
  },
  description:
    "Upload CSV, Excel, Parquet or connect your database for instant AI-powered exploratory data analysis. " +
    "Quality scores, natural-language queries, cleaning suggestions, and shareable reports — no code required.",
  keywords: [
    "EDA", "exploratory data analysis", "CSV analysis", "data quality",
    "data visualization", "AI data analysis", "NL to SQL", "data profiling",
    "PostgreSQL connector", "dataset monitoring", "data cleaning",
  ],
  authors: [{ name: "Sushi" }],
  creator: "Sushi",
  openGraph: {
    title: "Sushi — AI-Powered Data Analysis Platform",
    description:
      "Turn raw datasets into AI-powered insights in seconds. Quality scores, natural-language queries, " +
      "cleaning suggestions, and shareable reports.",
    type: "website",
    url: SITE_URL,
    siteName: "Sushi EDA",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Sushi EDA Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sushi — AI-Powered Data Analysis Platform",
    description: "Turn raw datasets into insights in seconds. No code required.",
    images: ["/og-image.png"],
    creator: "@sushi_eda",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.variable} ${instrumentSerif.variable} font-sans antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
