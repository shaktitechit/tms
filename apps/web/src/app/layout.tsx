import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { PortalChrome } from '@/components/portals';
import { Toaster } from '@/components/Toaster';
import { AuthProvider } from '@/lib/auth';
import { StoreProvider } from '@/store/provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TMS',
  description: 'Training Management System',
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StoreProvider>
          <AuthProvider>
            <PortalChrome>{children}</PortalChrome>
            <Toaster />
          </AuthProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
