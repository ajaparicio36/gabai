'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { List, Building2, LandPlot, Home, Store } from 'lucide-react';
import type {
  QuickEstimateResponse,
  QuickEstimateByTypeResponse,
} from '@/types/api';

interface QuickEstimatePopupProps {
  estimate: QuickEstimateResponse | undefined;
  estimateByType: QuickEstimateByTypeResponse | undefined;
  isLoading: boolean;
  onViewComparables?: () => void;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  residential_lot: { label: 'Residential Lot', icon: LandPlot },
  house_and_lot: { label: 'House & Lot', icon: Home },
  condo: { label: 'Condo', icon: Building2 },
  commercial: { label: 'Commercial', icon: Store },
};

const TYPE_ORDER = ['residential_lot', 'house_and_lot', 'condo', 'commercial'];

export function QuickEstimatePopup({
  estimate,
  estimateByType,
  isLoading,
  onViewComparables,
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
    <div className="rounded-lg border bg-background p-3 shadow-md space-y-2 max-w-[240px]">
      <div className="space-y-0.5">
        <p className="text-xs text-muted-foreground">Area Median</p>
        <p className="text-lg font-semibold">
          PHP {estimate.medianPhp.toLocaleString()}/sqm
        </p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>Low: PHP {estimate.lowPhp.toLocaleString()}</span>
          <span>High: PHP {estimate.highPhp.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {estimate.comparablesCount} comparables
          </Badge>
          {onViewComparables && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={onViewComparables}
            >
              <List className="mr-1 h-3 w-3" />
              View
            </Button>
          )}
        </div>
      </div>

      {estimateByType && (
        <div className="border-t pt-2 space-y-1">
          <p className="text-xs text-muted-foreground">By Property Type</p>
          {TYPE_ORDER.map((type) => {
            const perType = estimateByType[type];
            if (!perType || perType.comparablesCount === 0) return null;
            const config = TYPE_CONFIG[type];
            const Icon = config?.icon ?? Home;
            return (
              <div
                key={type}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-muted-foreground flex items-center gap-1">
                  <Icon className="h-3 w-3" />
                  {config?.label ?? type}
                </span>
                <span className="font-medium">
                  PHP {perType.medianPhp.toLocaleString()}/sqm
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
