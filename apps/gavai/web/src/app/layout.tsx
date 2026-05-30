import type { Metadata } from 'next';
import { Open_Sans, Bricolage_Grotesque, Fira_Code } from 'next/font/google';
import { Providers } from '@/providers/Providers';
import { Toaster } from '@/components/ui/sonner';
import './global.css';

const fontSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const fontSerif = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-serif',
});

const fontMono = Fira_Code({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'GAVAI — AI Property Valuation',
  description:
    'AI-powered Automated Valuation Model for global real estate. Get instant property valuations with confidence bands.',
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
