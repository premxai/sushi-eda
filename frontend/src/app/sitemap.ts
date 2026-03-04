import { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sushi-eda.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages = [
    { url: SITE_URL,                    priority: 1.0,  changeFrequency: "weekly"  as const },
    { url: `${SITE_URL}/pricing`,       priority: 0.9,  changeFrequency: "monthly" as const },
    { url: `${SITE_URL}/docs`,          priority: 0.85, changeFrequency: "weekly"  as const },
    { url: `${SITE_URL}/changelog`,     priority: 0.8,  changeFrequency: "weekly"  as const },
    { url: `${SITE_URL}/catalog`,       priority: 0.7,  changeFrequency: "monthly" as const },
    { url: `${SITE_URL}/integrations`,  priority: 0.7,  changeFrequency: "monthly" as const },
    { url: `${SITE_URL}/compare`,       priority: 0.65, changeFrequency: "monthly" as const },
    { url: `${SITE_URL}/sign-in`,       priority: 0.5,  changeFrequency: "yearly"  as const },
    { url: `${SITE_URL}/sign-up`,       priority: 0.6,  changeFrequency: "yearly"  as const },
  ];

  return staticPages.map((p) => ({ ...p, lastModified: now }));
}
