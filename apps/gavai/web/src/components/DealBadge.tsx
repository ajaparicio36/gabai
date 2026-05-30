'use client';

import { Badge } from '@/components/ui/badge';

interface DealBadgeProps {
  listingPricePerSqm: number | null;
  areaMedianPerSqm: number | null;
}

export function DealBadge({
  listingPricePerSqm,
  areaMedianPerSqm,
}: DealBadgeProps): React.ReactNode {
  if (!listingPricePerSqm || !areaMedianPerSqm) return null;
  if (areaMedianPerSqm <= 0) return null;

  const discountPct =
    ((areaMedianPerSqm - listingPricePerSqm) / areaMedianPerSqm) * 100;
  if (discountPct <= 5) return null;

  const savingsPerSqm = areaMedianPerSqm - listingPricePerSqm;
  const roundedPct = Math.round(discountPct);

  return (
    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 text-xs font-normal">
      {roundedPct}% below area median &mdash; save PHP{' '}
      {savingsPerSqm.toLocaleString()}/sqm
    </Badge>
  );
}
