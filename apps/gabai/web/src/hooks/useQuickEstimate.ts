'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { QuickEstimateResponse } from '@/types/api';

export function useQuickEstimate(
  lat: number | null,
  lng: number | null,
): {
  data: QuickEstimateResponse | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const query = useQuery<QuickEstimateResponse, Error>({
    queryKey: ['quickEstimate', lat, lng],
    queryFn: async () => {
      const response = await api.get<{ data: QuickEstimateResponse }>(
        '/heatmap/estimate',
        { params: { lat, lng } },
      );
      return response.data.data;
    },
    enabled: lat !== null && lng !== null,
    staleTime: 30 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
