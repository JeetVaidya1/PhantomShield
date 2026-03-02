import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Phantom Defender',
  description: 'Privacy-first disposable email aliases and burner phone numbers',
};

export const viewport: Viewport = {
  themeColor: '#0F0D23',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-phantom-bg text-phantom-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
