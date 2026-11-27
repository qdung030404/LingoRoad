import type { MetadataRoute } from 'next';

const DEFAULT_SITE_URL = 'https://lingoroad-admin-wfpi3gzq.azurewebsites.net';

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, '');
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/privacy', '/terms'],
      disallow: ['/admin', '/admin/', '/health'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
