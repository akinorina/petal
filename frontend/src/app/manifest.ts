import type { MetadataRoute } from 'next';

// Web App Manifest（Next.js Metadata API）。/manifest.webmanifest として配信される。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Petal',
    short_name: 'Petal',
    description: 'Petal 画像コンテンツ管理',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#D9624A',
    background_color: '#FBFAF7',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
