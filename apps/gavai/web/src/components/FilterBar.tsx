'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useState, useEffect } from 'react';

export interface HeatmapFilters {
  propertyType: string;
  priceMin: number;
  priceMax: number;
}

interface FilterBarProps {
  onFiltersChange: (filters: HeatmapFilters) => void;
}

const PROPERTY_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'residential_lot', label: 'Residential Lot' },
  { value: 'house_and_lot', label: 'House & Lot' },
  { value: 'condo', label: 'Condo' },
  { value: 'commercial', label: 'Commercial' },
];

export function FilterBar({
  onFiltersChange,
}: FilterBarProps): React.ReactNode {
  const [propertyType, setPropertyType] = useState('all');
  const [priceRange, setPriceRange] = useState([0, 500000]);

  useEffect(() => {
    onFiltersChange({
      propertyType,
      priceMin: priceRange[0],
      priceMax: priceRange[1],
    });
  }, [propertyType, priceRange, onFiltersChange]);

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">Type</Label>
        <Select value={propertyType} onValueChange={setPropertyType}>
          <SelectTrigger
            className="h-8 w-[140px] text-xs"
            title="Heatmap filter only — valuation shows all types"
          >
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map((pt) => (
              <SelectItem key={pt.value} value={pt.value}>
                {pt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2 flex-1">
        <Label className="text-xs whitespace-nowrap">
          PHP {priceRange[0].toLocaleString()} -{' '}
          {priceRange[1] >= 500000 ? '500K+' : priceRange[1].toLocaleString()}
        </Label>
        <Slider
          className="flex-1"
          value={priceRange}
          onValueChange={setPriceRange}
          min={0}
          max={500000}
          step={10000}
        />
      </div>
    </div>
  );
}
