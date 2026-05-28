'use client';

import { AlertTriangle } from 'lucide-react';

export function DisclaimerBanner(): React.ReactNode {
  return (
    <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
      <p className="text-[10px] text-muted-foreground">
        This is not a professional appraisal. Estimates are based on machine
        learning models trained on public listing data and may vary from actual
        market values. For official valuations, consult a licensed real estate
        appraiser.
      </p>
    </div>
  );
}
