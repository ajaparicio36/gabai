'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { AreaIntelligenceResponse } from '@/types/api';

export function useAreaIntel(
  lat: number | null,
  lng: number | null,
): {
  data: AreaIntelligenceResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  isStale: boolean;
} {
  const query = useQuery<AreaIntelligenceResponse, Error>({
    queryKey: ['areaIntel', lat, lng],
    queryFn: async () => {
      const response = await api.get<{ data: AreaIntelligenceResponse }>(
        '/area/intelligence',
        { params: { lat, lng } },
      );
      return response.data.data;
    },
    enabled: lat !== null && lng !== null,
    staleTime: 60 * 60 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    isStale: query.data?.stale ?? false,
  };
}
