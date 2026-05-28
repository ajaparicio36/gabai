import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display, Fira_Code } from 'next/font/google';
import { Providers } from '@/providers/Providers';
import { Toaster } from '@/components/ui/sonner';
// @ts-expect-error - global.css may not have type declarations yet
import './global.css';

const fontSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const fontSerif = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
});

const fontMono = Fira_Code({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'GABAI — AI Property Valuation',
  description:
    'AI-powered Automated Valuation Model for Philippine real estate. Get instant property valuations with confidence bands in Metro Cebu.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactNode {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} font-sans antialiased`}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
