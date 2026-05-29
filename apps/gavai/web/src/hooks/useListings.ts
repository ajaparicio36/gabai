'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { NearbyProperty } from '@/types/api';

export function useListings(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  propertyType?: string,
  priceMin?: number,
  priceMax?: number,
): {
  data: NearbyProperty[] | undefined;
  isLoading: boolean;
} {
  const query = useQuery<NearbyProperty[], Error>({
    queryKey: [
      'listings',
      minLat,
      minLng,
      maxLat,
      maxLng,
      propertyType,
      priceMin,
      priceMax,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        minLat: String(minLat),
        minLng: String(minLng),
        maxLat: String(maxLat),
        maxLng: String(maxLng),
      });
      if (propertyType) params.set('propertyType', propertyType);
      if (priceMin != null) params.set('priceMin', String(priceMin));
      if (priceMax != null) params.set('priceMax', String(priceMax));

      const response = await api.get<{
        data: NearbyProperty[];
      }>(`/heatmap/properties?${params.toString()}`);
      return response.data.data;
    },
    enabled: minLat != null && minLng != null,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
  };
}
