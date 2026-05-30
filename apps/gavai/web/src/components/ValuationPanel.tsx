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

function formatPropertyType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium">
                  {valuation.propertyType
                    ? `${formatPropertyType(valuation.propertyType)} Confidence Range`
                    : 'Confidence Range'}
                </p>
                {valuation.propertyType && (
                  <Badge variant="secondary" className="text-xs">
                    {formatPropertyType(valuation.propertyType)}
                  </Badge>
                )}
              </div>
              <div className="flex justify-between text-sm">
                <span>PHP {valuation.confidenceLowPhp.toLocaleString()}</span>
                <span className="text-muted-foreground">-</span>
                <span>PHP {valuation.confidenceHighPhp.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Range varies by property type.
              </p>
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
                growthScore={areaIntel.growthScore}
                growthConfidence={areaIntel.growthConfidence}
                growthReasoning={areaIntel.growthReasoning}
                growthDisclaimer={areaIntel.growthDisclaimer}
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
