'use client';

import { Badge } from '@/components/ui/badge';
import type { QuickEstimateResponse } from '@/types/api';

interface QuickEstimatePopupProps {
  estimate: QuickEstimateResponse | undefined;
  isLoading: boolean;
}

export function QuickEstimatePopup({
  estimate,
  isLoading,
}: QuickEstimatePopupProps): React.ReactNode {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <p className="text-xs text-muted-foreground">Loading estimate...</p>
      </div>
    );
  }

  if (!estimate) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <div className="space-y-1">
        <p className="text-lg font-semibold">
          PHP {estimate.medianPhp.toLocaleString()}/sqm
        </p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>Low: PHP {estimate.lowPhp.toLocaleString()}</span>
          <span>High: PHP {estimate.highPhp.toLocaleString()}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {estimate.comparablesCount} comparables
        </Badge>
      </div>
    </div>
  );
}
