'use client';

import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ModelCaveatProps {
  mape: number | undefined;
  trainingRecords: number | undefined;
}

export function ModelCaveat({
  mape,
  trainingRecords,
}: ModelCaveatProps): React.ReactNode | null {
  if (mape == null && trainingRecords == null) return null;

  const hasHighMape = mape != null && mape > 20;
  const hasLowTraining = trainingRecords != null && trainingRecords < 100;

  if (!hasHighMape && !hasLowTraining) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        {hasLowTraining &&
          `The model is trained on a limited dataset (${trainingRecords} records). `}
        {hasHighMape &&
          `Model error rate is high (MAPE: ${mape?.toFixed(1)}%). `}
        Estimates may have reduced accuracy.
      </AlertDescription>
    </Alert>
  );
}
