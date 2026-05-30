'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AreaIntelCard } from '@/components/AreaIntelCard';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { ElevationLabel } from '@/components/ElevationLabel';
import { RiskProgressBars } from '@/components/RiskProgressBars';
import { ValuationTypeCard } from '@/components/ValuationTypeCard';
import type { ValuationByTypeResponse } from '@/types/api';
import type { AreaIntelligenceResponse } from '@/types/api';
import type { RiskAssessmentResponse } from '@/types/api';
import { FileText } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  residential_lot: 'Residential Lot',
  house_and_lot: 'House & Lot',
  condo: 'Condo',
  commercial: 'Commercial',
};

interface ValuationPanelProps {
  valuations: ValuationByTypeResponse | undefined;
  areaIntel: AreaIntelligenceResponse | undefined;
  isAreaIntelStale: boolean;
  isValuationPending: boolean;
  onGenerateReport: (valuationId: string) => void;
  isReportPending: boolean;
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
  onGenerateReport,
  isReportPending,
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

  const [reportType, setReportType] = useState<string>(
    valuationEntries.length > 0 ? valuationEntries[0].propertyType : '',
  );

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

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Estimated Value by Property Type
              </p>
              {valuationEntries.map((v) => (
                <ValuationTypeCard key={v.propertyType} valuation={v} />
              ))}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {valuationEntries.map((v) => (
                      <SelectItem key={v.propertyType} value={v.propertyType}>
                        {TYPE_LABELS[v.propertyType] ?? v.propertyType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const selected = valuationEntries.find(
                    (v) => v.propertyType === reportType,
                  );
                  if (selected?.id) {
                    onGenerateReport(selected.id);
                  }
                }}
                disabled={isReportPending}
              >
                <FileText className="mr-2 h-4 w-4" />
                {isReportPending ? 'Generating Report...' : 'Generate Report'}
              </Button>
            </div>

            <DisclaimerBanner />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
