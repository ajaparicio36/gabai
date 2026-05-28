'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ModelVersion } from '@/types/api';

export function useModelVersions() {
  return useQuery<ModelVersion[]>({
    queryKey: ['admin', 'model', 'versions'],
    queryFn: async () => {
      const response = await api.get<{
        data: ModelVersion[];
      }>('/admin/model/versions');
      return response.data.data;
    },
    staleTime: 10_000,
  });
}
