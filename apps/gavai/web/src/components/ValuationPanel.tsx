'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaIntelCard } from '@/components/AreaIntelCard';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { ElevationLabel } from '@/components/ElevationLabel';
import { RiskProgressBars } from '@/components/RiskProgressBars';
import { ValuationTypeCard } from '@/components/ValuationTypeCard';
import type { ValuationByTypeResponse } from '@/types/api';
import type { AreaIntelligenceResponse } from '@/types/api';
import type { RiskAssessmentResponse } from '@/types/api';

interface ValuationPanelProps {
  valuations: ValuationByTypeResponse | undefined;
  areaIntel: AreaIntelligenceResponse | undefined;
  isAreaIntelStale: boolean;
  isValuationPending: boolean;
  onClose: () => void;
  selectedLat?: number | null;
  selectedLng?: number | null;
  riskScores?: RiskAssessmentResponse | undefined;
  isRiskScoresLoading?: boolean;
}

const TYPE_ORDER = ['residential_lot', 'house_and_lot', 'condo', 'commercial'];

export function ValuationPanel({
  valuations,
  areaIntel,
  isAreaIntelStale,
  isValuationPending,
  onClose,
  selectedLat,
  selectedLng,
  riskScores,
  isRiskScoresLoading,
}: ValuationPanelProps): React.ReactNode {
  const valuationEntries = valuations
    ? TYPE_ORDER.filter((type) => valuations[type]).map(
        (type) => valuations[type],
      )
    : [];

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
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-lg border p-4 space-y-3">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-7 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ) : valuationEntries.length > 0 ? (
          <div className="space-y-6 pt-8">
            <SheetHeader>
              <SheetTitle className="font-serif text-xl">
                Property Valuation
              </SheetTitle>
            </SheetHeader>

            {selectedLat != null && selectedLng != null && (
              <ElevationLabel lat={selectedLat} lng={selectedLng} />
            )}

            {isRiskScoresLoading ? (
              <div className="rounded-md border p-3 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-32 w-full rounded-md" />
              </div>
            ) : riskScores ? (
              <div className="rounded-md border p-3">
                <RiskProgressBars riskScores={riskScores} />
              </div>
            ) : null}

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

            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Estimated Value by Property Type
              </p>
              {TYPE_ORDER.filter((type) => valuations![type]).map((type) => (
                <ValuationTypeCard
                  key={type}
                  valuation={valuations![type]}
                  propertyType={type}
                />
              ))}
            </div>

            <DisclaimerBanner />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
