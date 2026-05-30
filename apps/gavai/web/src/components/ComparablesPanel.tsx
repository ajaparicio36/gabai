'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DealBadge } from '@/components/DealBadge';
import type { NearbyProperty } from '@/types/api';

const TYPE_LABELS: Record<string, string> = {
  residential_lot: 'Residential Lot',
  house_and_lot: 'House & Lot',
  condo: 'Condo',
  commercial: 'Commercial',
};

interface ComparablesPanelProps {
  open: boolean;
  onClose: () => void;
  comparables: NearbyProperty[] | undefined;
  isLoading: boolean;
  medianPrice?: number | null;
  count?: number;
  radiusM?: number;
}

function formatPropertyType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ComparableCard({
  property,
  medianPrice,
}: {
  property: NearbyProperty;
  medianPrice?: number | null;
}): React.ReactNode {
  const hasPhotos =
    property.photoUrls && (property.photoUrls as string[]).length > 0;
  const firstPhoto = hasPhotos ? (property.photoUrls as string[])[0] : null;

  return (
    <div className="flex gap-3 rounded-md border p-3">
      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md bg-muted">
        {firstPhoto ? (
          <img
            src={firstPhoto}
            alt={property.propertyType}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No photo
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {formatPropertyType(property.propertyType)}
          </Badge>
        </div>
        <p className="text-sm font-semibold">
          PHP {property.askingPricePhp.toLocaleString()}
        </p>
        {property.pricePerSqmPhp && (
          <p className="text-xs text-muted-foreground">
            PHP {property.pricePerSqmPhp.toLocaleString()}/sqm
          </p>
        )}
        {medianPrice != null && (
          <DealBadge
            listingPricePerSqm={property.pricePerSqmPhp}
            areaMedianPerSqm={medianPrice}
          />
        )}
        <p className="text-xs text-muted-foreground">
          {[
            property.lotAreaSqm ? `${property.lotAreaSqm} sqm lot` : null,
            property.floorAreaSqm ? `${property.floorAreaSqm} sqm floor` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Area: N/A'}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[property.barangay, property.city].filter(Boolean).join(', ') ||
            'Location: N/A'}
        </p>
        <p className="text-xs text-muted-foreground">
          {[
            property.bedrooms != null ? `${property.bedrooms} bed` : null,
            property.bathrooms != null ? `${property.bathrooms} bath` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </div>
  );
}

export function ComparablesPanel({
  open,
  onClose,
  comparables,
  isLoading,
  medianPrice,
  count,
  radiusM = 3000,
}: ComparablesPanelProps): React.ReactNode {
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const uniqueTypes = comparables
    ? [...new Set(comparables.map((c) => c.propertyType))]
    : [];

  const filteredComparables =
    typeFilter === 'all'
      ? comparables
      : comparables?.filter((c) => c.propertyType === typeFilter);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl">
            Comparable Listings
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {uniqueTypes.length > 0 && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {TYPE_LABELS[type] ?? formatPropertyType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {medianPrice != null && (
            <div className="rounded-md bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground">Area Median Price</p>
              <p className="text-lg font-semibold">
                PHP {medianPrice.toLocaleString()}/sqm
              </p>
              {count != null && (
                <p className="text-xs text-muted-foreground">
                  Based on {count} nearby listing{count !== 1 ? 's' : ''} within{' '}
                  {radiusM >= 1000 ? `${radiusM / 1000}km` : `${radiusM}m`}{' '}
                  radius
                </p>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 rounded-md border p-3">
                  <Skeleton className="h-20 w-28 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredComparables && filteredComparables.length > 0 ? (
            <div className="space-y-3">
              {filteredComparables.map((p) => (
                <ComparableCard
                  key={p.id}
                  property={p}
                  medianPrice={medianPrice}
                />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No comparable listings found in this area.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
