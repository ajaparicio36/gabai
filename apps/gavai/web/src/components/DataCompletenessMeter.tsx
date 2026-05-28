'use client';

import { Progress } from '@/components/ui/progress';

interface DataCompletenessMeterProps {
  completeness: number;
  missingFields?: string[];
}

export function DataCompletenessMeter({
  completeness,
  missingFields = [],
}: DataCompletenessMeterProps): React.ReactNode {
  const percentage = Math.round(completeness * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Data completeness</span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <Progress value={percentage} />
      {missingFields.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Missing: {missingFields.join(', ')}
        </p>
      )}
    </div>
  );
}
