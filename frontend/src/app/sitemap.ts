import { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sushi-eda.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages = [
    { url: SITE_URL,                    priority: 1.0,  changeFrequency: "weekly"  as const },
    { url: `${SITE_URL}/docs`,          priority: 0.85, changeFrequency: "weekly"  as const },
    { url: `${SITE_URL}/changelog`,     priority: 0.8,  changeFrequency: "weekly"  as const },
    { url: `${SITE_URL}/compare`,       priority: 0.65, changeFrequency: "monthly" as const },
    { url: `${SITE_URL}/privacy`,       priority: 0.4,  changeFrequency: "yearly"  as const },
  ];

  return staticPages.map((p) => ({ ...p, lastModified: now }));
}
