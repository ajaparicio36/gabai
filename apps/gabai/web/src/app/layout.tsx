import './global.css';
import { Providers } from '@/providers/Providers';

export const metadata = {
  title: 'GABAI — AI Property Valuation',
  description:
    'AI-powered Automated Valuation Model for Philippine real estate',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
