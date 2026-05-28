'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { TrainingRecord } from '@/types/api';

export function useTrainingRecords() {
  return useQuery<TrainingRecord[]>({
    queryKey: ['admin', 'train', 'records'],
    queryFn: async () => {
      const response = await api.get<{
        data: TrainingRecord[];
      }>('/admin/train/records');
      return response.data.data;
    },
    staleTime: 30_000,
  });
}
