import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Forge',
  description: 'Personal strength training tracker — walking skeleton.',
  // Phase 1 ships unhardened (per CONTEXT.md / SKELETON.md). robots/noindex
  // are deferred to Phase 4. Tell crawlers not to index in the meantime.
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Providers is a Client Component (TanStack Query). Plan 01-03 is the
            first plan that needs it — the home page + comparison report do
            not consume it but it's harmless overhead for those routes. */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
