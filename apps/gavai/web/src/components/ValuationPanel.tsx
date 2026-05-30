'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { AreaIntelCard } from '@/components/AreaIntelCard';
import { DataCompletenessMeter } from '@/components/DataCompletenessMeter';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { ElevationLabel } from '@/components/ElevationLabel';
import { SpiderChart } from '@/components/SpiderChart';
import type { ValuationResponse } from '@/types/api';
import type { AreaIntelligenceResponse } from '@/types/api';
import type { RiskAssessmentResponse } from '@/types/api';
import { FileText } from 'lucide-react';

interface ValuationPanelProps {
  valuation: ValuationResponse | undefined;
  areaIntel: AreaIntelligenceResponse | undefined;
  isAreaIntelStale: boolean;
  isValuationPending: boolean;
  onGenerateReport: () => void;
  isReportPending: boolean;
  onClose: () => void;
  selectedLat?: number | null;
  selectedLng?: number | null;
  riskScores?: RiskAssessmentResponse | undefined;
  isRiskScoresLoading?: boolean;
}

function getPriceSignal(birCompliance: ValuationResponse['birCompliance']): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive';
} | null {
  if (!birCompliance?.auditRiskScore) return null;

  if (birCompliance.riskLabel === 'green') {
    return { label: 'Fair Price', variant: 'default' };
  }
  if (birCompliance.riskLabel === 'yellow') {
    return { label: 'Slightly Above Floor', variant: 'secondary' };
  }
  if (birCompliance.riskLabel === 'red') {
    return { label: 'Well Above Floor', variant: 'destructive' };
  }
  return null;
}

export function ValuationPanel({
  valuation,
  areaIntel,
  isAreaIntelStale,
  isValuationPending,
  onGenerateReport,
  isReportPending,
  onClose,
  selectedLat,
  selectedLng,
  riskScores,
  isRiskScoresLoading,
}: ValuationPanelProps): React.ReactNode {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md"
        data-ob="valuation-panel"
      >
        {isValuationPending ? (
          <div className="space-y-6 pt-8">
            <Skeleton className="h-7 w-48" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-56" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ) : valuation ? (
          <div className="space-y-6 pt-8">
            <SheetHeader>
              <SheetTitle className="font-serif text-xl">
                Property Valuation
              </SheetTitle>
            </SheetHeader>

            <div>
              <p className="text-sm text-muted-foreground">Estimated Value</p>
              <p className="font-serif text-3xl font-semibold">
                PHP {valuation.pointEstimatePhp.toLocaleString()}
              </p>
              {selectedLat != null && selectedLng != null && (
                <ElevationLabel lat={selectedLat} lng={selectedLng} />
              )}
              <p className="text-sm text-muted-foreground">
                PHP {valuation.pricePerSqmPhp.toLocaleString()}/sqm
              </p>
            </div>

            <div className="flex flex-wrap gap-2" data-ob="confidence-badges">
              <ConfidenceBadge
                score={valuation.confidenceScore}
                comparablesCount={valuation.comparablesUsed}
              />
              {getPriceSignal(valuation.birCompliance) &&
                (() => {
                  const signal = getPriceSignal(valuation.birCompliance);
                  if (!signal) return null;
                  return <Badge variant={signal.variant}>{signal.label}</Badge>;
                })()}
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs font-medium">Confidence Range</p>
              <div className="flex justify-between text-sm">
                <span>PHP {valuation.confidenceLowPhp.toLocaleString()}</span>
                <span className="text-muted-foreground">-</span>
                <span>PHP {valuation.confidenceHighPhp.toLocaleString()}</span>
              </div>
            </div>

            <DataCompletenessMeter completeness={valuation.dataCompleteness} />

            {isRiskScoresLoading ? (
              <div className="rounded-md border p-3 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-32 w-full rounded-md" />
              </div>
            ) : riskScores ? (
              <div className="rounded-md border p-3">
                <SpiderChart riskScores={riskScores} />
              </div>
            ) : null}

            {valuation.birCompliance && (
              <div className="space-y-1 rounded-md border p-3">
                <p className="text-xs font-medium">BIR Compliance</p>
                {valuation.birCompliance.complianceFloorPhp && (
                  <p className="text-xs text-muted-foreground">
                    Floor: PHP{' '}
                    {valuation.birCompliance.complianceFloorPhp.toLocaleString()}
                  </p>
                )}
                {valuation.birCompliance.auditRiskScore != null && (
                  <p className="text-xs text-muted-foreground">
                    Risk: {valuation.birCompliance.auditRiskScore.toFixed(1)}%
                  </p>
                )}
                <p className="text-xs italic text-muted-foreground">
                  Based on BIR zonal values that may be outdated. Not a legal
                  assessment.
                </p>
              </div>
            )}

            <Separator />

            {areaIntel && (
              <AreaIntelCard
                areaName={areaIntel.areaName}
                bulletPoints={areaIntel.bulletPoints}
                sources={areaIntel.sources}
                lastUpdated={areaIntel.lastUpdated}
                stale={isAreaIntelStale}
                yieldScore={areaIntel.yieldScore}
                yieldArticleCount={areaIntel.yieldArticleCount}
                yieldPositiveRatio={areaIntel.yieldPositiveRatio}
              />
            )}

            <Separator />

            <Button
              variant="outline"
              className="w-full"
              onClick={onGenerateReport}
              disabled={isReportPending}
            >
              <FileText className="mr-2 h-4 w-4" />
              {isReportPending ? 'Generating Report...' : 'Generate Report'}
            </Button>

            <DisclaimerBanner />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
