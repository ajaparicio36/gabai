'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  LandPlot,
  Home,
  Store,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ValuationResponse } from '@/types/api';

interface ValuationTypeCardProps {
  valuation: ValuationResponse;
  propertyType: string;
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

function getConfidenceColor(score: number): string {
  if (score >= 0.85) return 'text-green-600';
  if (score >= 0.7) return 'text-yellow-600';
  return 'text-red-600';
}

export function ValuationTypeCard({
  valuation,
  propertyType,
}: ValuationTypeCardProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[propertyType] ?? {
    label: propertyType,
    icon: Home,
  };
  const Icon = config.icon;
  const isFormulaFallback = valuation.modelVersion === 'formula_fallback';

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium text-sm">{config.label}</span>
          {isFormulaFallback && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Estimated
            </Badge>
          )}
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      <div>
        <p className="text-xl font-semibold font-serif">
          PHP {valuation.pointEstimatePhp.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">
          PHP {valuation.pricePerSqmPhp.toLocaleString()}/sqm
        </p>
      </div>

      {expanded && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Confidence Score</span>
            <span className={getConfidenceColor(valuation.confidenceScore)}>
              {Math.round(valuation.confidenceScore * 100)}%
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Data Completeness</span>
            <span>{Math.round(valuation.dataCompleteness * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
