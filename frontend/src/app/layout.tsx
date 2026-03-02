import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Sushi - Serve Your Raw Data Perfectly",
  description: "Upload CSV, Excel, or JSON files for instant exploratory data analysis. Transform raw data into beautiful insights in seconds.",
  keywords: ["EDA", "data analysis", "CSV analysis", "data quality", "exploratory data analysis", "data visualization", "raw data"],
  authors: [{ name: "Sushi" }],
  openGraph: {
    title: "Sushi - Raw Data, Perfectly Served",
    description: "Transform your raw datasets into beautiful, actionable insights with instant exploratory data analysis.",
    type: "website",
    url: "https://sushi-eda.vercel.app",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Sushi EDA Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sushi - Serve Your Raw Data Perfectly",
    description: "Transform raw data into beautiful insights",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.variable} font-sans bg-white text-neutral-900 antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
