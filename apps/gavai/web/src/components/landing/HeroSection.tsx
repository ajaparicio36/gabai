'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { HeroValuationCard } from '@/components/landing/HeroValuationCard';

export function HeroSection(): React.ReactNode {
  return (
    <section className="relative min-h-screen overflow-hidden bg-secondary px-4 pt-16">
      {/* Subtle dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 25%, hsl(54, 83%, 95%) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-12 py-16 lg:grid-cols-2 lg:gap-8">
        {/* Left column */}
        <div className="flex flex-col justify-center">
          {/* Headline */}
          <h1 className="font-serif text-5xl font-bold leading-[0.95] tracking-tight text-secondary-foreground sm:text-6xl md:text-7xl lg:text-[5.5rem]">
            <span className="block [-webkit-text-stroke:2px_currentColor] [-webkit-text-fill-color:transparent]">
              EVERY
            </span>
            <span className="block">PROPERTY.</span>
            <span className="block [-webkit-text-stroke:2px_currentColor] [-webkit-text-fill-color:transparent]">
              EVERY
            </span>
            <span className="block">PRICE.</span>
          </h1>

          {/* Description */}
          <p className="mt-8 max-w-md text-base leading-relaxed text-secondary-foreground/70 sm:text-lg">
            GAVAI is an{' '}
            <span className="font-semibold text-secondary-foreground">
              AI-native Automated Valuation Model
            </span>{' '}
            that continuously scrapes, structures, and models property data from
            public and private sources — delivering{' '}
            <span className="font-semibold text-secondary-foreground">
              real-time, defensible valuations
            </span>{' '}
            for any lot, house, condo, or commercial building in seconds.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row">
            <Link href="/auth/signup">
              <Button
                size="lg"
                className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90"
              >
                Generate Free Valuation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent border-secondary-foreground/30 text-secondary-foreground hover:bg-secondary-foreground/10"
              >
                Explore the API
              </Button>
            </a>
          </div>
        </div>

        {/* Right column */}
        <div className="relative flex items-center justify-center lg:justify-end">
          {/* Decorative dot grid behind card */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 50% 50%, hsl(54, 83%, 95%) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <HeroValuationCard />
        </div>
      </div>
    </section>
  );
}
