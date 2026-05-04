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

export const metadata: Metadata = {
  title: 'Snapshot — photo galleries',
  description: 'Private photo galleries for clients.',
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
