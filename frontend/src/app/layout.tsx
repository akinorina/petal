import type { Metadata, Viewport } from 'next';
import { SerwistProvider } from '@serwist/next/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { FloatingTreeProvider } from '@/components/FloatingTreeProvider';
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
    // Chrome for iOS 等が `<html>` に注入する属性（例: __gcrremoteframetoken）による
    // hydration mismatch 警告を抑止する。属性差分のみ 1 階層抑止し、他の hydration バグは検知したまま。
    <html lang="ja" className="h-full" suppressHydrationWarning>
      <body className="min-h-full bg-surface-page text-text-primary antialiased">
        <SerwistProvider
          swUrl="/sw.js"
          disable={process.env.NODE_ENV !== 'production'}
        >
          <FloatingTreeProvider>
            <AuthProvider>{children}</AuthProvider>
          </FloatingTreeProvider>
          <UpdateNotice />
          <InstallPrompt />
          <StandaloneLaunchTracker />
        </SerwistProvider>
      </body>
    </html>
  );
}
