'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { NearbyProperty } from '@/types/api';

export function useComparables(
  lat: number | null,
  lng: number | null,
  propertyType?: string,
): {
  data: NearbyProperty[] | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const query = useQuery<NearbyProperty[], Error>({
    queryKey: ['comparables', lat, lng, propertyType],
    queryFn: async () => {
      const response = await api.get<{ data: NearbyProperty[] }>(
        '/heatmap/comparables',
        { params: { lat, lng, propertyType } },
      );
      return response.data.data;
    },
    enabled: lat !== null && lng !== null,
    staleTime: 60 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
