import type { Metadata, Viewport } from 'next';
import { SerwistProvider } from '@serwist/next/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { UpdateNotice } from '@/components/UpdateNotice';
import { InstallPrompt } from '@/components/InstallPrompt';
import { StandaloneLaunchTracker } from '@/components/StandaloneLaunchTracker';
import './globals.css';

export const metadata: Metadata = {
  title: 'Petal',
  description: 'Petal 管理画面',
  applicationName: 'Petal',
  // iOS Safari 向け：ホーム画面追加でスタンドアロン起動させる。
  appleWebApp: {
    capable: true,
    title: 'Petal',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#D9624A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full bg-surface-page text-text-primary antialiased">
        <SerwistProvider
          swUrl="/sw.js"
          disable={process.env.NODE_ENV !== 'production'}
        >
          <AuthProvider>{children}</AuthProvider>
          <UpdateNotice />
          <InstallPrompt />
          <StandaloneLaunchTracker />
        </SerwistProvider>
      </body>
    </html>
  );
}
