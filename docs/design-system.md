Tailwind Color Theme

```css
@import 'tailwindcss';

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.9848 0.0237 101.6588);
  --foreground: oklch(0.2454 0.0324 134.2874);
  --card: oklch(0.9546 0.0291 100.5812);
  --card-foreground: oklch(0.2454 0.0324 134.2874);
  --popover: oklch(0.9848 0.0237 101.6588);
  --popover-foreground: oklch(0.2454 0.0324 134.2874);
  --primary: oklch(0.2454 0.0324 134.2874);
  --primary-foreground: oklch(0.9848 0.0237 101.6588);
  --secondary: oklch(0.3319 0.0436 135.1361);
  --secondary-foreground: oklch(0.9848 0.0237 101.6588);
  --muted: oklch(0.8961 0.0388 100.6795);
  --muted-foreground: oklch(0.452 0.0417 132.5283);
  --accent: oklch(0.9546 0.0291 100.5812);
  --accent-foreground: oklch(0.2454 0.0324 134.2874);
  --destructive: oklch(0.4367 0.1293 24.2064);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.8437 0.0446 100.1617);
  --input: oklch(0.8437 0.0446 100.1617);
  --ring: oklch(0.2454 0.0324 134.2874);
  --chart-1: oklch(0.3319 0.0436 135.1361);
  --chart-2: oklch(0.452 0.0417 132.5283);
  --chart-3: oklch(0.6086 0.0669 134.3912);
  --chart-4: oklch(0.739 0.0564 123.8131);
  --chart-5: oklch(0.8788 0.0139 92.998);
  --sidebar: oklch(0.2454 0.0324 134.2874);
  --sidebar-foreground: oklch(0.9848 0.0237 101.6588);
  --sidebar-primary: oklch(0.9848 0.0237 101.6588);
  --sidebar-primary-foreground: oklch(0.2454 0.0324 134.2874);
  --sidebar-accent: oklch(0.3319 0.0436 135.1361);
  --sidebar-accent-foreground: oklch(0.9848 0.0237 101.6588);
  --sidebar-border: oklch(0.3319 0.0436 135.1361);
  --sidebar-ring: oklch(0.9848 0.0237 101.6588);
  --font-sans: DM Sans, ui-sans-serif, sans-serif, system-ui;
  --font-serif: Playfair Display, ui-serif, serif;
  --font-mono: Fira Code, ui-monospace, monospace;
  --radius: 0rem;
  --shadow-x: 0px;
  --shadow-y: 4px;
  --shadow-blur: 10px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.1;
  --shadow-color: #000000;
  --shadow-2xs: 0px 4px 10px 0px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0px 4px 10px 0px hsl(0 0% 0% / 0.05);
  --shadow-sm:
    0px 4px 10px 0px hsl(0 0% 0% / 0.1), 0px 1px 2px -1px hsl(0 0% 0% / 0.1);
  --shadow:
    0px 4px 10px 0px hsl(0 0% 0% / 0.1), 0px 1px 2px -1px hsl(0 0% 0% / 0.1);
  --shadow-md:
    0px 4px 10px 0px hsl(0 0% 0% / 0.1), 0px 2px 4px -1px hsl(0 0% 0% / 0.1);
  --shadow-lg:
    0px 4px 10px 0px hsl(0 0% 0% / 0.1), 0px 4px 6px -1px hsl(0 0% 0% / 0.1);
  --shadow-xl:
    0px 4px 10px 0px hsl(0 0% 0% / 0.1), 0px 8px 10px -1px hsl(0 0% 0% / 0.1);
  --shadow-2xl: 0px 4px 10px 0px hsl(0 0% 0% / 0.25);
  --tracking-normal: 0.05em;
  --spacing: 0.25rem;
}

.dark {
  --background: oklch(0.2145 0.0241 137.3183);
  --foreground: oklch(0.9848 0.0237 101.6588);
  --card: oklch(0.2454 0.0324 134.2874);
  --card-foreground: oklch(0.9848 0.0237 101.6588);
  --popover: oklch(0.2145 0.0241 137.3183);
  --popover-foreground: oklch(0.9848 0.0237 101.6588);
  --primary: oklch(0.9848 0.0237 101.6588);
  --primary-foreground: oklch(0.2145 0.0241 137.3183);
  --secondary: oklch(0.3319 0.0436 135.1361);
  --secondary-foreground: oklch(0.9848 0.0237 101.6588);
  --muted: oklch(0.2713 0.0368 137.2687);
  --muted-foreground: oklch(0.739 0.0564 123.8131);
  --accent: oklch(0.3319 0.0436 135.1361);
  --accent-foreground: oklch(0.9848 0.0237 101.6588);
  --destructive: oklch(0.354 0.1143 25.1968);
  --destructive-foreground: oklch(0.9848 0.0237 101.6588);
  --border: oklch(0.3319 0.0436 135.1361);
  --input: oklch(0.3319 0.0436 135.1361);
  --ring: oklch(0.9848 0.0237 101.6588);
  --chart-1: oklch(0.9848 0.0237 101.6588);
  --chart-2: oklch(0.739 0.0564 123.8131);
  --chart-3: oklch(0.6086 0.0669 134.3912);
  --chart-4: oklch(0.452 0.0417 132.5283);
  --chart-5: oklch(0.3319 0.0436 135.1361);
  --sidebar: oklch(0.1771 0.0202 135.4684);
  --sidebar-foreground: oklch(0.9848 0.0237 101.6588);
  --sidebar-primary: oklch(0.9848 0.0237 101.6588);
  --sidebar-primary-foreground: oklch(0.2145 0.0241 137.3183);
  --sidebar-accent: oklch(0.2454 0.0324 134.2874);
  --sidebar-accent-foreground: oklch(0.9848 0.0237 101.6588);
  --sidebar-border: oklch(0.2454 0.0324 134.2874);
  --sidebar-ring: oklch(0.9848 0.0237 101.6588);
  --font-sans: DM Sans, ui-sans-serif, sans-serif, system-ui;
  --font-serif: Playfair Display, ui-serif, serif;
  --font-mono: Fira Code, ui-monospace, monospace;
  --radius: 0rem;
  --shadow-x: 0px;
  --shadow-y: 6px;
  --shadow-blur: 12px;
  --shadow-spread: 2px;
  --shadow-opacity: 0.5;
  --shadow-color: #000000;
  --shadow-2xs: 0px 6px 12px 2px hsl(0 0% 0% / 0.25);
  --shadow-xs: 0px 6px 12px 2px hsl(0 0% 0% / 0.25);
  --shadow-sm:
    0px 6px 12px 2px hsl(0 0% 0% / 0.5), 0px 1px 2px 1px hsl(0 0% 0% / 0.5);
  --shadow:
    0px 6px 12px 2px hsl(0 0% 0% / 0.5), 0px 1px 2px 1px hsl(0 0% 0% / 0.5);
  --shadow-md:
    0px 6px 12px 2px hsl(0 0% 0% / 0.5), 0px 2px 4px 1px hsl(0 0% 0% / 0.5);
  --shadow-lg:
    0px 6px 12px 2px hsl(0 0% 0% / 0.5), 0px 4px 6px 1px hsl(0 0% 0% / 0.5);
  --shadow-xl:
    0px 6px 12px 2px hsl(0 0% 0% / 0.5), 0px 8px 10px 1px hsl(0 0% 0% / 0.5);
  --shadow-2xl: 0px 6px 12px 2px hsl(0 0% 0% / 1.25);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);

  --tracking-tighter: calc(var(--tracking-normal) - 0.05em);
  --tracking-tight: calc(var(--tracking-normal) - 0.025em);
  --tracking-normal: var(--tracking-normal);
  --tracking-wide: calc(var(--tracking-normal) + 0.025em);
  --tracking-wider: calc(var(--tracking-normal) + 0.05em);
  --tracking-widest: calc(var(--tracking-normal) + 0.1em);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    letter-spacing: var(--tracking-normal);
  }
}
```

layout.tsx

```tsx
// For adding custom fonts with other frameworks, see:
// https://tailwindcss.com/docs/font-family
import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display, Fira_Code } from 'next/font/google';
import './globals.css';

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
  title: 'Create Next App',
  description: 'Generated by create next app',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```
