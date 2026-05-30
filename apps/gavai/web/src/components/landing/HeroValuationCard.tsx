'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export function HeroValuationCard(): React.ReactNode {
  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-sm border border-secondary-foreground/15 bg-secondary/60 backdrop-blur-sm">
      {/* Top-right floating meta badge */}
      <div className="absolute right-4 top-4 z-10 rounded-sm border border-secondary-foreground/20 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-secondary-foreground/60">
        Benchmark Value &middot; $1,200/SQM
      </div>

      {/* Main card content */}
      <div className="p-6 pt-12">
        {/* Header row */}
        <div className="mb-4 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-secondary-foreground/50">
              <span>Residential</span>
              <span>&middot;</span>
              <span>Condominium</span>
            </div>
            <h3 className="text-lg font-semibold leading-tight text-secondary-foreground">
              Unit 12B, The Alcoves
            </h3>
            <p className="text-sm text-secondary-foreground/60">
              BGC, Taguig City
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </div>
        </div>

        {/* Divider with meta */}
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-secondary-foreground/10" />
          <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-wider text-secondary-foreground/40">
            12 Comparable Sales &middot; 500m Radius
          </span>
        </div>

        {/* Total estimate */}
        <div className="mb-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-secondary-foreground/50">
            Total Property Estimate
          </p>
          <p className="text-4xl font-bold tabular-nums tracking-tight text-secondary-foreground sm:text-5xl">
            $6.48M
          </p>
        </div>

        {/* Range bar */}
        <div className="mb-6 space-y-1">
          <div className="flex justify-between text-[10px] text-secondary-foreground/40">
            <span>$5.9M</span>
            <span>$7.1M</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary-foreground/10">
            <div
              className="h-full rounded-full bg-secondary-foreground/80"
              style={{ width: '68%', marginLeft: '12%' }}
            />
          </div>
        </div>

        {/* Metric grid */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-sm border border-secondary-foreground/10 bg-secondary/40 p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-secondary-foreground/50">
              Per Sqm
            </p>
            <p className="text-sm font-semibold tabular-nums text-secondary-foreground">
              $108,000
            </p>
          </div>
          <div className="rounded-sm border border-secondary-foreground/10 bg-secondary/40 p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-secondary-foreground/50">
              Floor Area
            </p>
            <p className="text-sm font-semibold tabular-nums text-secondary-foreground">
              60 sqm
            </p>
          </div>
          <div className="rounded-sm border border-secondary-foreground/10 bg-secondary/40 p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-secondary-foreground/50">
              Model
            </p>
            <p className="text-sm font-semibold text-secondary-foreground">
              GAVAI v3.1
            </p>
          </div>
          <div className="rounded-sm border border-secondary-foreground/10 bg-secondary/40 p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-secondary-foreground/50">
              Refreshed
            </p>
            <p className="text-sm font-semibold text-secondary-foreground">
              Just now
            </p>
          </div>
        </div>

        {/* Confidence score */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-secondary-foreground/50">
              Confidence Score
            </span>
            <span className="text-xs font-semibold tabular-nums text-secondary-foreground">
              91 / 100
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary-foreground/10">
            <div
              className="h-full rounded-full bg-secondary-foreground/80"
              style={{ width: '91%' }}
            />
          </div>
        </div>

        {/* Source badges & CTA */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-secondary-foreground/20 text-[10px] uppercase tracking-wider text-secondary-foreground/50"
          >
            PSA
          </Badge>
          <Badge
            variant="outline"
            className="border-secondary-foreground/20 text-[10px] uppercase tracking-wider text-secondary-foreground/50"
          >
            BIR
          </Badge>
          <Badge
            variant="outline"
            className="border-secondary-foreground/20 text-[10px] uppercase tracking-wider text-secondary-foreground/50"
          >
            LGU
          </Badge>
          <Badge
            variant="outline"
            className="border-secondary-foreground/20 text-[10px] uppercase tracking-wider text-secondary-foreground/50"
          >
            +9
          </Badge>
          <Button
            size="sm"
            className="ml-auto bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Bottom status strip */}
      <div className="border-t border-secondary-foreground/10 px-6 py-2.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-secondary-foreground/40">
          $/SQM Estimate Active
        </span>
      </div>
    </div>
  );
}
