import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, BarChart3 } from 'lucide-react';

export default function LandingPage(): React.ReactNode {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-lg">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <BarChart3 className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="font-serif text-4xl tracking-tight">GAVAI</h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
          AI-powered property valuation for Philippine real estate. Get instant
          estimates, confidence bands, and area intelligence for Metro Cebu.
        </p>
        <div className="flex gap-4">
          <Link href="/auth/signup">
            <Button size="lg">Get Started</Button>
          </Link>
          <Link href="/auth/login">
            <Button variant="outline" size="lg">
              Sign In
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="mt-8 flex gap-8 text-sm text-muted-foreground">
          <div className="text-center">
            <p className="font-medium text-foreground">Instant</p>
            <p>Valuations</p>
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">ML-Powered</p>
            <p>Estimates</p>
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">Area</p>
            <p>Intel</p>
          </div>
        </div>
      </div>
    </div>
  );
}
