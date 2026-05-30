import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function HeroSection(): React.ReactNode {
  return (
    <section className="relative flex min-h-screen items-center justify-center bg-secondary px-4 pt-16">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 25%, hsl(54, 83%, 95%) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative mx-auto max-w-4xl text-center">
        <div className="mx-auto mb-8 flex items-center justify-center">
          <Image
            src="/gavai_text_logo.png"
            alt="GAVAI"
            width={360}
            height={180}
            className="h-auto w-[360px]"
          />
        </div>
        <h1 className="font-serif text-4xl font-bold tracking-tight text-secondary-foreground sm:text-5xl md:text-6xl">
          AI-Powered Property Valuations for the Philippines
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-secondary-foreground/80 sm:text-xl">
          Get instant, ML-driven property estimates with confidence bands, area
          intelligence, and risk analysis for Metro Manila.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/auth/signup">
            <Button
              size="lg"
              className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="#features">
            <Button
              size="lg"
              variant="outline"
              className="border-secondary-foreground/30 text-secondary hover:bg-secondary-foreground/10"
            >
              Learn More
            </Button>
          </a>
        </div>
        <p className="mt-6 text-sm text-secondary-foreground/60">
          No credit card required. Free tier available.
        </p>
      </div>
    </section>
  );
}
