'use client';

import { Badge } from '@/components/ui/badge';
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

interface ConfidenceBadgeProps {
  score: number;
  comparablesCount: number;
}

function getConfidenceLevel(score: number): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive';
  className: string;
} {
  if (score >= 0.85) {
    return {
      label: 'High',
      variant: 'default',
      className: 'bg-chart-2 text-primary-foreground',
    };
  }
  if (score >= 0.7) {
    return {
      label: 'Medium',
      variant: 'secondary',
      className: 'bg-chart-3 text-primary-foreground',
    };
  }
  return {
    label: 'Low',
    variant: 'destructive',
    className: '',
  };
}

export function ConfidenceBadge({
  score,
  comparablesCount,
}: ConfidenceBadgeProps): React.ReactNode {
  const level = getConfidenceLevel(score);
  const percentage = Math.round(score * 100);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={level.variant} className={level.className}>
            {level.label} ({percentage}%)
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Based on {comparablesCount} comparables</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
