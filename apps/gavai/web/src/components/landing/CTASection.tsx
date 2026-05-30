import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function CTASection(): React.ReactNode {
  return (
    <section className="bg-secondary px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-serif text-3xl font-bold tracking-tight text-secondary-foreground sm:text-4xl">
          Ready to find your property&apos;s value?
        </h2>
        <p className="mt-4 text-lg text-secondary-foreground/80">
          Join thousands of users making smarter real estate decisions with AI.
        </p>
        <div className="mt-10">
          <Link href="/auth/signup">
            <Button
              size="lg"
              className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
