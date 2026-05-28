'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { HeatmapTileResponse } from '@/types/api';

interface HeatmapParams {
  bbox: string;
  propertyType?: string;
}

interface UseHeatmapResult {
  data: HeatmapTileResponse | undefined;
  isLoading: boolean;
  isNoData: boolean;
}

export function useHeatmap(params: HeatmapParams | null): UseHeatmapResult {
  const query = useQuery<HeatmapTileResponse | null, Error>({
    queryKey: ['heatmap', params?.bbox, params?.propertyType],
    queryFn: async () => {
      try {
        const response = await api.get<{ data: HeatmapTileResponse }>(
          '/heatmap/tiles',
          { params },
        );
        return response.data.data;
      } catch (err: unknown) {
        const error = err as {
          response?: { data?: { error?: { code?: string } } };
        };
        if (error?.response?.data?.error?.code === 'HEATMAP.NO_DATA') {
          return null;
        }
        throw err;
      }
    },
    enabled: !!params?.bbox,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: query.data ?? undefined,
    isLoading: query.isLoading,
    isNoData: query.data === null,
  };
}
