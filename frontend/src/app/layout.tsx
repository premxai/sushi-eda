import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
});

// Used sparingly, only for the landing page headline.
const instrumentSerif = localFont({
  src: [
    { path: "./fonts/InstrumentSerif-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/InstrumentSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sushi-eda.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sushi | Your RAW Data Served Perfectly",
    template: "%s | Sushi",
  },
  description:
    "Drop in a data file and get a trustworthy, plain-English report you can share with your team: quality score, AI summary, charts, and answers to your questions. No code, no analyst required.",
  keywords: [
    "data analysis for product managers",
    "file analysis",
    "data quality score",
    "AI data summary",
    "survey results analysis",
    "A/B test analysis",
    "no-code data analysis",
  ],
  authors: [{ name: "Sushi" }],
  creator: "Sushi",
  openGraph: {
    title: "Sushi | Your RAW Data Served Perfectly",
    description: "Drop in a data file, get a plain-English report you can trust and share. No code required.",
    type: "website",
    url: SITE_URL,
    siteName: "Sushi",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
