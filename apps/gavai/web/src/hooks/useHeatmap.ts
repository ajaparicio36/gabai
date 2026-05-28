'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { HeatmapTileResponse } from '@/types/api';

interface HeatmapParams {
  bbox: string;
  propertyType?: string;
}

export function useHeatmap(params: HeatmapParams | null): {
  data: HeatmapTileResponse | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const query = useQuery<HeatmapTileResponse, Error>({
    queryKey: ['heatmap', params?.bbox, params?.propertyType],
    queryFn: async () => {
      const response = await api.get<{ data: HeatmapTileResponse }>(
        '/heatmap/tiles',
        { params },
      );
      return response.data.data;
    },
    enabled: !!params?.bbox,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
