'use client';

import { MapPin, Layers, Crosshair } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type MapViewMode = 'heatmap' | 'listings' | 'valuation';

interface ViewToggleProps {
  value: MapViewMode;
  onChange: (value: MapViewMode) => void;
}

export function ViewToggle({
  value,
  onChange,
}: ViewToggleProps): React.ReactNode {
  return (
    <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v as MapViewMode);
        }}
        className="rounded-lg border bg-background shadow-md"
      >
        <ToggleGroupItem value="heatmap" aria-label="Heatmap view">
          <Layers className="mr-1 h-4 w-4" />
          Heatmap
        </ToggleGroupItem>
        <ToggleGroupItem value="listings" aria-label="Listings view">
          <MapPin className="mr-1 h-4 w-4" />
          Listings
        </ToggleGroupItem>
        <ToggleGroupItem value="valuation" aria-label="Valuation view">
          <Crosshair className="mr-1 h-4 w-4" />
          Valuation
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
