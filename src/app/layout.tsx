import type { Metadata } from 'next';
import { Archivo_Black, Albert_Sans } from 'next/font/google';
import './globals.css';

const display = Archivo_Black({
  variable: '--font-display',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
});

const body = Albert_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
});

// Absolute base for og:image / twitter:image. Falls back to localhost in dev.
// Tolerates APP_URL set without a scheme (e.g. "snapshare.example.com").
const rawAppUrl = process.env.APP_URL || 'http://localhost:3000';
const appUrl = /^https?:\/\//.test(rawAppUrl) ? rawAppUrl : `https://${rawAppUrl}`;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: 'Snapshot — photo galleries',
  description: 'Private photo galleries for clients.',
  openGraph: {
    title: 'Snapshot — photo galleries',
    description: 'Private photo galleries for clients.',
    type: 'website',
    siteName: 'Snapshot',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Snapshot — photo galleries',
    description: 'Private photo galleries for clients.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Sync theme before paint to avoid flash. */}
        <script src="/theme-boot.js" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
